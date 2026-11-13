"""Refresh tokens: long-lived, stored (hashed) in the DB, rotated on every use.

access_token  (JWT, 15 min, path=/)            -> sent with every request
refresh_token (random, 7 days, path=/api/v1/auth) -> only sent to /refresh and /logout

Rotation: each refresh swaps the refresh token for a new one. Presenting an already
rotated token again (outside a short grace window) means it was copied, so every
session of that user is revoked.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Response
from sqlalchemy import DateTime, ForeignKey, String, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.oauth import jwt
from app.oauth.user import Users
from app.shared.models import Base

REFRESH_TOKEN_TTL = timedelta(days=7)
# Two tabs refreshing at the same moment both send the same token. The second one
# arrives just after the first rotated it; that's not theft, so allow it briefly.
ROTATION_GRACE = timedelta(seconds=30)

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)  # sha256 hex; raw token never stored
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshError(Exception):
    pass


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def issue(session: AsyncSession, user_id: int) -> str:
    """Create a refresh token for user_id (caller commits). Returns the raw token for the cookie."""
    now = datetime.now(UTC)
    # Housekeeping: drop this user's expired tokens so the table doesn't grow forever.
    await session.execute(
        delete(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.expires_at < now)
    )
    token = secrets.token_urlsafe(32)
    session.add(RefreshToken(user_id=user_id, token_hash=_hash(token), expires_at=now + REFRESH_TOKEN_TTL))
    return token


async def rotate(session: AsyncSession, token: str) -> tuple[Users, str | None]:
    """Exchange a refresh token. Returns (user, new_refresh_token).

    new_refresh_token is None inside the grace window: another tab already rotated it and
    its response set the new cookie, which all tabs share.
    """
    now = datetime.now(UTC)
    # FOR UPDATE: two simultaneous refreshes with the same token are handled one after the other.
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == _hash(token)).with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None or row.revoked_at is not None or row.expires_at <= now:
        raise RefreshError("Invalid refresh token")

    if row.rotated_at is not None:
        if now - row.rotated_at <= ROTATION_GRACE:
            user = await session.get(Users, row.user_id)
            await session.commit()
            if user is None:
                raise RefreshError("User not found")
            return user, None
        # Reuse of an old token: assume it was stolen and log this user out everywhere.
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == row.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await session.commit()
        raise RefreshError("Refresh token reuse detected")

    user = await session.get(Users, row.user_id)
    if user is None:
        raise RefreshError("User not found")
    row.rotated_at = now
    new_token = await issue(session, user.id)
    await session.commit()
    return user, new_token


async def revoke(session: AsyncSession, token: str) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == _hash(token), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await session.commit()


# ponytail: secure=False because the 42 callback still lands on http://localhost:8000.
# Flip to True once the whole flow goes through https (nginx).
def set_auth_cookies(response: Response, user: Users, refresh_token: str | None) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        jwt.create_access_token(user.id),
        max_age=jwt.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        httponly=True,
        secure=False,
        samesite="lax",
    )
    if refresh_token is not None:
        response.set_cookie(
            REFRESH_COOKIE,
            refresh_token,
            max_age=int(REFRESH_TOKEN_TTL.total_seconds()),
            path=REFRESH_COOKIE_PATH,
            httponly=True,
            secure=False,
            samesite="lax",
        )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/", httponly=True, samesite="lax")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, httponly=True, samesite="lax")

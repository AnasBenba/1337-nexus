from __future__ import annotations

import os
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth import jwt
from app.oauth.user import Users

# Password hashing using Argon2 (pwdlib[argon2])
_pwd_hasher = PasswordHash.recommended()

DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def hash_password(password: str) -> str:
    """Hash a plaintext password using salted Argon2."""
    return _pwd_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against an Argon2 hash."""
    return _pwd_hasher.verify(plain_password, hashed_password)


async def get_or_create_dev_user(db: AsyncSession) -> Users:
    """Ensure a deterministic default developer user exists in development.

    Prevents foreign-key violations when testing routes like pitches in Swagger UI.
    """
    user = await db.get(Users, DEV_USER_ID)
    if user is not None:
        return user

    # Check by login in case ID differed
    result = await db.execute(select(Users).where(Users.login == "dev_user"))
    existing = result.scalar_one_or_none()
    if existing is not None:
        return existing

    dev_user = Users(
        id=DEV_USER_ID,
        login="dev_user",
        email="dev@1337.ma",
        fullname="1337 Dev User",
        role="admin",
        password_hash=hash_password("devpassword123"),
        is_active=True,
    )
    db.add(dev_user)
    try:
        await db.commit()
        await db.refresh(dev_user)
        return dev_user
    except Exception:
        await db.rollback()
        # Fallback to whatever user exists
        res = await db.execute(select(Users).limit(1))
        found = res.scalar_one_or_none()
        if found is not None:
            return found
        raise


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Users:
    """FastAPI dependency to extract and authenticate the current user.

    Reads access token from:
    1. HttpOnly 'access_token' cookie
    2. 'Authorization: Bearer <token>' header

    If no token is provided in non-production environments, gracefully
    falls back to a default dev user for seamless Swagger UI testing.
    """
    auth_header = request.headers.get("Authorization")
    token: str | None = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    if not token:
        token = request.cookies.get("access_token")

    if token:
        payload = jwt.verify_access_token(token)
        sub = payload.get("sub")
        if sub:
            try:
                user_id = uuid.UUID(sub)
                user = await db.get(Users, user_id)
                if user and user.is_active:
                    return user
            except (ValueError, TypeError):
                # If sub was stored as integer intra_id or string login
                result = await db.execute(
                    select(Users).where((Users.login == sub) | (Users.email == sub))
                )
                user = result.scalar_one_or_none()
                if user and user.is_active:
                    return user

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated",
        )

    # In dev/testing mode, provide the dev fallback so Swagger UI executes effortlessly
    is_prod = os.getenv("ENV", "development").lower() in ("prod", "production")
    if not is_prod:
        return await get_or_create_dev_user(db)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


async def get_current_user_strict(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Users:
    """Strict dependency requiring an active authentication token without dev fallback."""
    auth_header = request.headers.get("Authorization")
    token: str | None = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required",
        )

    payload = jwt.verify_access_token(token)
    sub = payload.get("sub")
    if sub:
        try:
            user_id = uuid.UUID(sub)
            user = await db.get(Users, user_id)
            if user and user.is_active:
                return user
        except (ValueError, TypeError):
            result = await db.execute(select(Users).where(Users.login == sub))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token",
    )

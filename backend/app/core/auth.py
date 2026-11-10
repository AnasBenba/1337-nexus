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
from app.user.dependencies import get_current_user as base_get_current_user

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

    Prevents foreign-key violations when testing routes in Swagger UI.
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

    Uses the robust tab-scoped bearer priority from dependencies.py.
    Falls back to dev user in dev/testing mode if unauthenticated.
    """
    try:
        return await base_get_current_user(request, db)
    except HTTPException:
        is_prod = os.getenv("ENV", "development").lower() in ("prod", "production")
        if not is_prod:
            return await get_or_create_dev_user(db)
        raise


async def get_current_user_strict(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Users:
    """Strict dependency requiring an active authentication token without dev fallback."""
    return await base_get_current_user(request, db)

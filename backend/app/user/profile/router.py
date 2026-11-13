"""User profile endpoints adapted from Soufiane's profile module for UUID users."""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import ColumnElement, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_strict
from app.core.db import get_db_session
from app.oauth.permissions import Permission, require
from app.oauth.user import Users
from app.user.profile.avatar import (
    AVATAR_DIR,
    AVATAR_URL_PREFIX,
    MAX_AVATAR_BYTES,
    InvalidAvatarError,
    delete_avatar_file,
    process_avatar,
)
from app.user.profile.schemas import MyProfile, ProfileUpdate, UserProfile, UserSummary

router = APIRouter(prefix="/api/v1/users", tags=["users"])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]
StrictUser = Annotated[Users, Depends(get_current_user_strict)]
CanEditOwnProfile = Annotated[Users, Depends(require(Permission.EDIT_OWN_PROFILE))]


def _login_or_name_contains(q: str) -> ColumnElement[bool]:
    """Case-insensitive filter matching login or fullname containing query."""
    pattern = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    return or_(Users.login.ilike(pattern, escape="\\"), Users.fullname.ilike(pattern, escape="\\"))


@router.get("", response_model=list[UserSummary], summary="Search users by login or name")
async def search_users(
    _: StrictUser,
    session: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=50)],
) -> list[Users]:
    result = await session.execute(
        select(Users)
        .where(Users.is_active.is_(True), _login_or_name_contains(q))
        .order_by(Users.login)
        .limit(20)
    )
    return list(result.scalars().all())


@router.get("/me", response_model=MyProfile, summary="Get my profile")
async def get_my_profile(me: StrictUser) -> Users:
    return me


@router.put("/me", response_model=MyProfile, summary="Update my profile")
async def update_my_profile(
    body: ProfileUpdate,
    me: CanEditOwnProfile,
    session: DbSession,
) -> Users:
    me.fullname = body.fullname
    me.bio = body.bio or None
    await session.commit()
    await session.refresh(me)
    return me


@router.post("/me/avatar", response_model=MyProfile, summary="Upload my avatar")
async def upload_avatar(
    file: UploadFile,
    me: CanEditOwnProfile,
    session: DbSession,
) -> Users:
    data = await file.read(MAX_AVATAR_BYTES + 1)
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "Image must be 2 MB or smaller.",
        )
    try:
        webp = await run_in_threadpool(process_avatar, data)
    except InvalidAvatarError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    name = f"{me.id}-{secrets.token_hex(8)}.webp"
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    await run_in_threadpool((AVATAR_DIR / name).write_bytes, webp)

    old_url, me.avatar_url = me.avatar_url, AVATAR_URL_PREFIX + name
    await session.commit()
    await session.refresh(me)
    delete_avatar_file(old_url)
    return me


@router.delete(
    "/me/avatar",
    response_model=MyProfile,
    summary="Remove my avatar (back to default)",
)
async def delete_avatar(me: CanEditOwnProfile, session: DbSession) -> Users:
    old_url, me.avatar_url = me.avatar_url, None
    await session.commit()
    await session.refresh(me)
    delete_avatar_file(old_url)
    return me


@router.get("/{login}", response_model=UserProfile, summary="Get a user's profile")
async def get_profile(login: str, _: StrictUser, session: DbSession) -> Users:
    result = await session.execute(select(Users).where(Users.login == login))
    found = result.scalar_one_or_none()
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return found

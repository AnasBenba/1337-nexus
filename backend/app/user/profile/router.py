import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import CurrentUser
from app.oauth.permissions import Permission, require
from app.oauth.user import Users, login_or_name_contains
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
# Editing your own profile/avatar needs this permission (see app/oauth/permissions.py).
CanEditOwnProfile = Annotated[Users, Depends(require(Permission.EDIT_OWN_PROFILE))]


@router.get("", response_model=list[UserSummary], summary="Search users by login or name")
async def search_users(
    _: CurrentUser,
    session: DbSession,
    q: Annotated[str, Query(min_length=1, max_length=50)],
) -> list[Users]:
    result = await session.execute(
        select(Users)
        .where(login_or_name_contains(q))
        .order_by(Users.login)
        .limit(20)
    )
    return list(result.scalars().all())


# /me must be declared before /{login} so "me" isn't treated as a login.
@router.get("/me", response_model=MyProfile, summary="Get my profile")
async def get_my_profile(me: CurrentUser) -> Users:
    return me


@router.put("/me", response_model=MyProfile, summary="Update my profile")
async def update_my_profile(body: ProfileUpdate, me: CanEditOwnProfile, session: DbSession) -> Users:
    me.fullname = body.fullname
    me.bio = body.bio or None
    await session.commit()
    await session.refresh(me)
    return me


@router.post("/me/avatar", response_model=MyProfile, summary="Upload my avatar")
async def upload_avatar(file: UploadFile, me: CanEditOwnProfile, session: DbSession) -> Users:
    data = await file.read(MAX_AVATAR_BYTES + 1)
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image must be 2 MB or smaller.")
    try:
        webp = await run_in_threadpool(process_avatar, data)
    except InvalidAvatarError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc

    # A new random name on every upload, so browsers/nginx never serve a cached old avatar.
    name = f"{me.id}-{secrets.token_hex(8)}.webp"
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    await run_in_threadpool((AVATAR_DIR / name).write_bytes, webp)

    old_url, me.avatar_url = me.avatar_url, AVATAR_URL_PREFIX + name
    await session.commit()
    await session.refresh(me)
    delete_avatar_file(old_url)
    return me


@router.delete("/me/avatar", response_model=MyProfile, summary="Remove my avatar (back to default)")
async def delete_avatar(me: CanEditOwnProfile, session: DbSession) -> Users:
    old_url, me.avatar_url = me.avatar_url, None
    await session.commit()
    await session.refresh(me)
    delete_avatar_file(old_url)
    return me


@router.get("/{login}", response_model=UserProfile, summary="Get a user's profile")
async def get_profile(login: str, _: CurrentUser, session: DbSession) -> Users:
    result = await session.execute(select(Users).where(Users.login == login))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

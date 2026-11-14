"""User management: list, view, edit, change role, remove avatar, delete.

Who can act on whom (see app/oauth/permissions.py):
- admins manage users;
- the superadmin manages admins and users, and is the only one who can change roles;
- nobody can manage the superadmin, or their own account here.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.users.schemas import AdminUserPage, AdminUserUpdate
from app.core.db import get_db_session
from app.oauth.permissions import Permission, Role, can_manage, has_permission, require
from app.oauth.user import Users, login_or_name_contains
from app.user.profile.avatar import delete_avatar_file
from app.user.profile.schemas import UserProfile

router = APIRouter(prefix="/api/v1/admin/users", tags=["admin"])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]
CanViewUsers = Annotated[Users, Depends(require(Permission.VIEW_USERS))]
CanEditUsers = Annotated[Users, Depends(require(Permission.EDIT_USERS))]
CanDeleteUsers = Annotated[Users, Depends(require(Permission.DELETE_USERS))]


async def _get_or_404(session: AsyncSession, user_id: UUID) -> Users:
    user = await session.get(Users, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


def _check_can_manage(actor: Users, target: Users) -> None:
    """403 with a clear reason unless `actor` outranks `target`."""
    if can_manage(actor, target):
        return
    if actor.id == target.id:
        reason = "You can't manage your own account here; use your profile page."
    elif target.role == Role.SUPERADMIN:
        reason = "The superadmin account is protected."
    else:
        reason = "Only the superadmin can manage admins."
    raise HTTPException(status.HTTP_403_FORBIDDEN, reason)


@router.get("", response_model=AdminUserPage, summary="List users (search, filter by role, paginate)")
async def list_users(
    _: CanViewUsers,
    session: DbSession,
    q: Annotated[str | None, Query(max_length=50)] = None,
    role: Role | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminUserPage:
    query = select(Users)
    if q and q.strip():
        query = query.where(login_or_name_contains(q))
    if role is not None:
        query = query.where(Users.role == role)

    total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = await session.execute(query.order_by(Users.login).offset((page - 1) * page_size).limit(page_size))
    items = [UserProfile.model_validate(u) for u in rows.scalars().all()]
    return AdminUserPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{user_id}", response_model=UserProfile, summary="View one user")
async def get_user(user_id: UUID, _: CanViewUsers, session: DbSession) -> Users:
    return await _get_or_404(session, user_id)


@router.patch("/{user_id}", response_model=UserProfile, summary="Edit a user's name, bio or role")
async def update_user(user_id: UUID, body: AdminUserUpdate, actor: CanEditUsers, session: DbSession) -> Users:
    user = await _get_or_404(session, user_id)
    _check_can_manage(actor, user)
    changes = body.model_dump(exclude_none=True)

    if "role" in changes and changes["role"] != user.role and not has_permission(actor, Permission.MANAGE_ROLES):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the superadmin can change roles.")

    if "bio" in changes:
        changes["bio"] = changes["bio"] or None
    for field, value in changes.items():
        setattr(user, field, value)
    await session.commit()
    await session.refresh(user)
    return user


@router.delete("/{user_id}/avatar", response_model=UserProfile, summary="Remove a user's avatar")
async def remove_user_avatar(user_id: UUID, actor: CanEditUsers, session: DbSession) -> Users:
    user = await _get_or_404(session, user_id)
    _check_can_manage(actor, user)
    old_url, user.avatar_url = user.avatar_url, None
    await session.commit()
    await session.refresh(user)
    delete_avatar_file(old_url)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a user")
async def delete_user(user_id: UUID, actor: CanDeleteUsers, session: DbSession) -> Response:
    user = await _get_or_404(session, user_id)
    _check_can_manage(actor, user)
    avatar_url = user.avatar_url
    # The DB cascades: friendships and refresh tokens are deleted, pitches keep author = NULL.
    await session.delete(user)
    await session.commit()
    delete_avatar_file(avatar_url)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

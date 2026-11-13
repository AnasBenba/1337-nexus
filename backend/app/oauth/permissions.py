"""Roles, what each role may do, and who may manage whom.

Endpoints check *permissions*, never role names, so changing what a role can do is a
small edit to ROLE_PERMISSIONS below.

    user        normal account (every new sign-up / 42 login)
    admin       manages *users*: view, edit, delete
    superadmin  created only by the startup script (app/cli/create_superadmin.py);
                manages admins too and is the only one who can grant/remove admin.
                Nobody can edit, delete or re-role a superadmin through the API.
"""

from collections.abc import Callable, Coroutine
from enum import StrEnum
from typing import Any

from fastapi import Depends, HTTPException, status

from app.oauth.dependencies import get_current_user
from app.oauth.user import Users


class Role(StrEnum):
    USER = "user"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


# Roles the API may hand out. "superadmin" is never assignable: only the startup script creates it.
ASSIGNABLE_ROLES = (Role.USER, Role.ADMIN)


class Permission(StrEnum):
    EDIT_OWN_PROFILE = "profile:edit_own"  # name, bio, avatar
    MANAGE_FRIENDS = "friends:manage"  # send/accept/remove friends
    VIEW_USERS = "users:view"  # user management list
    EDIT_USERS = "users:edit"  # edit someone else's name/bio/avatar
    DELETE_USERS = "users:delete"
    MANAGE_ROLES = "users:manage_roles"  # make someone admin / remove admin


_USER = frozenset({Permission.EDIT_OWN_PROFILE, Permission.MANAGE_FRIENDS})
_ADMIN = _USER | {Permission.VIEW_USERS, Permission.EDIT_USERS, Permission.DELETE_USERS}

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.USER: _USER,
    Role.ADMIN: _ADMIN,
    Role.SUPERADMIN: _ADMIN | {Permission.MANAGE_ROLES},
}

# Higher rank can manage lower rank, never equal or higher. So admins manage users,
# the superadmin manages admins and users, and nobody manages the superadmin.
_RANK = {Role.USER: 0, Role.ADMIN: 1, Role.SUPERADMIN: 2}


def _role(value: str) -> Role | None:
    try:
        return Role(value)
    except ValueError:
        return None  # unknown role (the DB constraint should prevent this)


def permissions_for(role: str) -> frozenset[Permission]:
    known = _role(role)
    return ROLE_PERMISSIONS[known] if known else frozenset()


def has_permission(user: Users, permission: Permission) -> bool:
    return permission in permissions_for(user.role)


def can_manage(actor: Users, target: Users) -> bool:
    """May `actor` edit/delete/re-role `target`? Only if strictly higher rank (so never yourself)."""
    actor_role, target_role = _role(actor.role), _role(target.role)
    if actor_role is None or target_role is None or actor.id == target.id:
        return False
    return _RANK[actor_role] > _RANK[target_role]


def require(permission: Permission) -> Callable[..., Coroutine[Any, Any, Users]]:
    """FastAPI dependency: the current user, or 403 if their role lacks `permission`."""

    async def dependency(user: Users = Depends(get_current_user)) -> Users:
        if not has_permission(user, permission):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Your role ({user.role}) is not allowed to do this.",
            )
        return user

    return dependency

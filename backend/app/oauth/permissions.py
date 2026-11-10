"""Roles and what each role may do.

Endpoints check *permissions*, never role names, so changing what a role can do (or
adding a role later) is a small edit to ROLE_PERMISSIONS below.
"""

import os
from collections.abc import Callable, Coroutine
from enum import StrEnum
from typing import Any

from fastapi import Depends, HTTPException, status

from app.oauth.dependencies import get_current_user
from app.oauth.user import Users


class Role(StrEnum):
    USER = "user"  # default for every new 42 login
    ADMIN = "admin"


class Permission(StrEnum):
    EDIT_OWN_PROFILE = "profile:edit_own"  # name, bio, avatar
    MANAGE_FRIENDS = "friends:manage"  # send/accept/remove friends
    VIEW_USERS = "users:view"  # user management list
    EDIT_USERS = "users:edit"  # edit someone else's name/bio/avatar
    MANAGE_ROLES = "users:manage_roles"
    DELETE_USERS = "users:delete"


_USER = frozenset({Permission.EDIT_OWN_PROFILE, Permission.MANAGE_FRIENDS})

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.USER: _USER,
    Role.ADMIN: _USER | {Permission.VIEW_USERS, Permission.EDIT_USERS, Permission.MANAGE_ROLES, Permission.DELETE_USERS},
}


def permissions_for(role: str) -> frozenset[Permission]:
    try:
        return ROLE_PERMISSIONS[Role(role)]
    except ValueError:
        return frozenset()  # unknown role: allow nothing (the DB constraint should prevent this)


def has_permission(user: Users, permission: Permission) -> bool:
    return permission in permissions_for(user.role)


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


def admin_logins() -> set[str]:
    """Logins that become admin when they sign in (ADMIN_LOGINS=login1,login2 in .env)."""
    return {login.strip() for login in os.getenv("ADMIN_LOGINS", "").split(",") if login.strip()}

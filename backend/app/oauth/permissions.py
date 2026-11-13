"""Roles and permissions for 1337 Nexus endpoints.

Endpoints check permissions rather than hardcoding role strings directly.
"""

from collections.abc import Callable, Coroutine
from enum import StrEnum
from typing import Any

from fastapi import Depends, HTTPException, status

from app.core.auth import get_current_user_strict
from app.oauth.user import Users


class Role(StrEnum):
    USER = "user"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


ASSIGNABLE_ROLES = (Role.USER, Role.ADMIN)


class Permission(StrEnum):
    EDIT_OWN_PROFILE = "profile:edit_own"
    MANAGE_FRIENDS = "friends:manage"
    VIEW_USERS = "users:view"
    EDIT_USERS = "users:edit"
    MANAGE_ROLES = "users:manage_roles"
    DELETE_USERS = "users:delete"


ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.USER: frozenset({Permission.EDIT_OWN_PROFILE, Permission.MANAGE_FRIENDS}),
    Role.ADMIN: frozenset(
        {
            Permission.EDIT_OWN_PROFILE,
            Permission.MANAGE_FRIENDS,
            Permission.VIEW_USERS,
            Permission.EDIT_USERS,
            Permission.DELETE_USERS,
        }
    ),
    Role.SUPERADMIN: frozenset(Permission),
}


def permissions_for(role: str) -> frozenset[Permission]:
    """Return all permissions granted to the given role."""
    try:
        return ROLE_PERMISSIONS[Role(role)]
    except ValueError:
        return frozenset()


def require(permission: Permission) -> Callable[[Users], Coroutine[Any, Any, Users]]:
    """FastAPI dependency requiring the authenticated user to hold a permission."""

    async def check(user: Users = Depends(get_current_user_strict)) -> Users:
        if permission not in permissions_for(user.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return check

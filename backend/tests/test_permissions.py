from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.oauth.permissions import (
    ASSIGNABLE_ROLES,
    Permission,
    Role,
    can_manage,
    has_permission,
    permissions_for,
    require,
)
from app.oauth.user import Users


def _user(role: str, user_id: int = 1) -> Users:
    return Users(id=uuid4(), login=f"t_{role}_{user_id}", fullname=role, role=role)


def test_each_role_includes_the_one_below() -> None:
    assert permissions_for("user") < permissions_for("admin") < permissions_for("superadmin")


def test_superadmin_is_never_assignable() -> None:
    assert Role.SUPERADMIN not in ASSIGNABLE_ROLES


@pytest.mark.parametrize(
    ("role", "permission", "allowed"),
    [
        ("user", Permission.EDIT_OWN_PROFILE, True),
        ("user", Permission.VIEW_USERS, False),
        ("admin", Permission.VIEW_USERS, True),
        ("admin", Permission.EDIT_USERS, True),
        ("admin", Permission.DELETE_USERS, True),
        ("admin", Permission.MANAGE_ROLES, False),  # only the superadmin changes roles
        ("superadmin", Permission.MANAGE_ROLES, True),
        ("hacker", Permission.EDIT_OWN_PROFILE, False),  # unknown role gets nothing
    ],
)
def test_permission_matrix(role: str, permission: Permission, allowed: bool) -> None:
    assert has_permission(_user(role), permission) is allowed


@pytest.mark.parametrize(
    ("actor", "target", "allowed"),
    [
        ("admin", "user", True),
        ("admin", "admin", False),  # admins can't touch other admins
        ("admin", "superadmin", False),
        ("superadmin", "user", True),
        ("superadmin", "admin", True),
        ("superadmin", "superadmin", False),  # nobody manages a superadmin
        ("user", "user", False),
    ],
)
def test_who_can_manage_whom(actor: str, target: str, allowed: bool) -> None:
    assert can_manage(_user(actor, 1), _user(target, 2)) is allowed


def test_nobody_manages_themselves() -> None:
    me = _user("superadmin", 7)
    assert can_manage(me, me) is False


async def test_require_returns_user_or_403() -> None:
    dep = require(Permission.MANAGE_ROLES)
    boss = _user(Role.SUPERADMIN)
    assert await dep(user=boss) is boss
    with pytest.raises(HTTPException) as exc:
        await dep(user=_user(Role.ADMIN))
    assert exc.value.status_code == 403

import pytest
from fastapi import HTTPException

from app.oauth.permissions import (
    Permission,
    Role,
    admin_logins,
    has_permission,
    permissions_for,
    require,
)
from app.oauth.user import Users


def _user(role: str) -> Users:
    return Users(login=f"t_{role}", fullname=role, role=role)


def test_admin_can_do_everything_a_user_can() -> None:
    assert permissions_for("user") < permissions_for("admin")


@pytest.mark.parametrize(
    ("role", "permission", "allowed"),
    [
        ("user", Permission.EDIT_OWN_PROFILE, True),
        ("user", Permission.MANAGE_FRIENDS, True),
        ("user", Permission.VIEW_USERS, False),
        ("user", Permission.EDIT_USERS, False),
        ("user", Permission.MANAGE_ROLES, False),
        ("user", Permission.DELETE_USERS, False),
        ("admin", Permission.VIEW_USERS, True),
        ("admin", Permission.EDIT_USERS, True),
        ("admin", Permission.MANAGE_ROLES, True),
        ("admin", Permission.DELETE_USERS, True),
        ("hacker", Permission.EDIT_OWN_PROFILE, False),  # unknown role gets nothing
    ],
)
def test_permission_matrix(role: str, permission: Permission, allowed: bool) -> None:
    assert has_permission(_user(role), permission) is allowed


async def test_require_returns_user_or_403() -> None:
    dep = require(Permission.DELETE_USERS)
    admin = _user(Role.ADMIN)
    assert await dep(user=admin) is admin
    with pytest.raises(HTTPException) as exc:
        await dep(user=_user(Role.USER))
    assert exc.value.status_code == 403


def test_admin_logins_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_LOGINS", " ofrikel, souel-bo ,,")
    assert admin_logins() == {"ofrikel", "souel-bo"}
    monkeypatch.delenv("ADMIN_LOGINS")
    assert admin_logins() == set()

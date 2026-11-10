import pytest
from pydantic import ValidationError

from app.user.profile.schemas import ProfileUpdate


def test_profile_update_strips_whitespace() -> None:
    body = ProfileUpdate(fullname="  Oumayma Frikel  ", bio="  hi  ")
    assert body.fullname == "Oumayma Frikel"
    assert body.bio == "hi"


@pytest.mark.parametrize(
    "payload",
    [
        {"fullname": ""},  # empty name
        {"fullname": "   "},  # whitespace-only name
        {"fullname": "x" * 101},  # name too long
        {"fullname": "ok", "bio": "x" * 501},  # bio too long
        {"fullname": "ok", "role": "admin"},  # not editable here
    ],
)
def test_profile_update_rejects_invalid(payload: dict[str, str]) -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate(**payload)

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.user.profile.schemas import UserProfile


class AdminUserPage(BaseModel):
    items: list[UserProfile]
    total: int
    page: int
    page_size: int


class AdminUserUpdate(BaseModel):
    """Only the fields you send are changed. Changing `role` needs users:manage_roles (superadmin)."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fullname: str | None = Field(default=None, min_length=1, max_length=100)
    bio: str | None = Field(default=None, max_length=500)  # "" clears it
    # Matches permissions.ASSIGNABLE_ROLES: "superadmin" can never be given through the API.
    role: Literal["user", "admin"] | None = None

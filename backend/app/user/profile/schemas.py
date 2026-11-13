"""Pydantic schemas for user profile endpoints (UUID user IDs)."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.oauth.permissions import permissions_for


class UserProfile(BaseModel):
    """Public profile returned by GET /api/v1/users/me and GET /api/v1/users/{login}."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login: str
    fullname: str
    role: str
    intra_id: int | None
    email: str | None = None
    bio: str | None
    avatar_url: str | None


class MyProfile(UserProfile):
    """Authenticated user's own profile including granted UI permissions."""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def permissions(self) -> list[str]:
        return sorted(str(p) for p in permissions_for(self.role))


class UserSummary(BaseModel):
    """Compact user summary returned by user search."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login: str
    fullname: str
    avatar_url: str | None


class ProfileUpdate(BaseModel):
    """Editable fields on a user's profile."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fullname: str = Field(min_length=1, max_length=100)
    bio: str = Field(default="", max_length=500)

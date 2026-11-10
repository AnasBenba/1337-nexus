from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login: str
    fullname: str
    email: str | None = None
    role: str = "user"
    avatar_url: str | None = None
    bio: str | None = None
    campus: str | None = None
    created_at: datetime | None = None
    is_self: bool = False
    is_friend: bool = False
    stats: dict[str, int] = Field(default_factory=dict)


class ProfileUpdateRequest(BaseModel):
    fullname: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=1000)
    avatar_url: str | None = Field(default=None, max_length=500)
    campus: str | None = Field(default=None, max_length=100)


class UserSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login: str
    fullname: str
    avatar_url: str | None = None
    campus: str | None = None
    bio: str | None = None
    role: str = "user"
    is_friend: bool = False

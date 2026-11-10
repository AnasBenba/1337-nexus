from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FriendUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login: str
    fullname: str
    avatar_url: str | None = None
    campus: str | None = None
    bio: str | None = None
    role: str = "user"
    is_online: bool = False
    friended_at: datetime | None = None


class FriendshipStatusResponse(BaseModel):
    target_id: uuid.UUID
    is_friend: bool
    friendship_id: uuid.UUID | None = None


class AddFriendResponse(BaseModel):
    status: str
    message: str
    friendship_id: uuid.UUID | None = None
    friend: FriendUserResponse | None = None

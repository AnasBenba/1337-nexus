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
    status: str = "none"  # "none" | "pending_sent" | "pending_received" | "accepted"
    friendship_id: uuid.UUID | None = None


class FriendRequestItem(BaseModel):
    friendship_id: uuid.UUID
    user: FriendUserResponse
    created_at: datetime
    type: str  # "incoming" | "outgoing"


class FriendRequestsResponse(BaseModel):
    incoming: list[FriendRequestItem]
    outgoing: list[FriendRequestItem]


class AddFriendResponse(BaseModel):
    status: str
    message: str
    friendship_status: str = "pending"  # "pending" | "accepted"
    friendship_id: uuid.UUID | None = None
    friend: FriendUserResponse | None = None

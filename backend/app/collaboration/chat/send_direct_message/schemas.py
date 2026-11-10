from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)
    receiver_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    content: str
    sender_id: uuid.UUID
    receiver_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    is_read: bool = False
    is_delivered: bool = False
    created_at: datetime


class ConversationPartner(BaseModel):
    id: uuid.UUID
    login: str
    fullname: str
    avatar_url: str | None = None
    campus: str | None = None
    is_online: bool = True


class ConversationSummary(BaseModel):
    peer: ConversationPartner
    last_message: MessageResponse | None = None
    unread_count: int = 0

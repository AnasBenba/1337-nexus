
from uuid import UUID

from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str
    sender_id: UUID
    receiver_id: UUID | None = None
    team_id: int | None = None

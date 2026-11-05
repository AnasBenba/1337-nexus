
from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str
    sender_id: int
    receiver_id: int | None = None
    team_id: int | None = None

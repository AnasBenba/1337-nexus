
import uuid
from pydantic import BaseModel

class MessageCreate(BaseModel):
    content: str
    receiver_id: uuid.UUID
    sender_id: uuid.UUID

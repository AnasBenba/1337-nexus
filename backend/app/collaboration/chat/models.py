import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Uuid
from app.shared.models import Base # Adjust this import to match your Base location

class Message(Base):
    __tablename__ = "messages"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    sender_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)

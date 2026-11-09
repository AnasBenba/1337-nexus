import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Text, Uuid

from app.shared.models import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    sender_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    team_id = Column(Uuid(as_uuid=True), ForeignKey("workspace_teams.id"), nullable=True, index=True)
    receiver_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    is_delivered = Column(Boolean, default=False, nullable=False)
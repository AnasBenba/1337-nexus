from datetime import UTC, datetime
import uuid
from enum import Enum

from sqlalchemy import Boolean, Column, DateTime, Enum as SqlEnum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as Uuid

from app.shared.models import Base


class NotificationType(str, Enum):
    USER_MESSAGE = "user_message"
    FRIEND_REQUEST = "friend_request"


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_recipient_read", "recipient_id", "is_read"),
    )
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notification_request_id = Column(Uuid(as_uuid=True), nullable=True)
    type = Column(SqlEnum(NotificationType), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    is_read = Column(Boolean, default=False, nullable=False)

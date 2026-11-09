from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID

from app.shared.models import Base


class Message(Base):  # type: ignore[misc]
    __tablename__ = "messages"

    id = Column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    sender_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    team_id = Column(Integer, nullable=True, index=True)
    receiver_id = Column(PostgreSQLUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)

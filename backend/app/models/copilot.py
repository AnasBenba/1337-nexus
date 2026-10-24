from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base


class CopilotThread(Base):  # type: ignore[misc]
    """
    Database model representing a conversation thread with the copilot.
    Matches schema: Table copilot_threads.
    """

    __tablename__ = "copilot_threads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    subject_slug: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(
        String(255), nullable=False, default="New Thread"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=lambda: datetime.now(UTC),
    )

    messages: Mapped[list[CopilotMessage]] = relationship(
        "CopilotMessage",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CopilotMessage.created_at",
    )


class CopilotMessage(Base):  # type: ignore[misc]
    """
    Database model representing a message in a copilot thread.
    Matches schema: Table copilot_messages.
    """

    __tablename__ = "copilot_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("copilot_threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="completed"
    )
    context_chunks: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True
    )
    tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=lambda: datetime.now(UTC),
    )

    thread: Mapped[CopilotThread] = relationship(
        "CopilotThread", back_populates="messages"
    )

    @property
    def conversation_id(self) -> uuid.UUID:
        """Alias for backward-compatibility with conversation_id callers."""
        return self.thread_id

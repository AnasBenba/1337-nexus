from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, LargeBinary, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base


class CanvasDocument(Base):  # type: ignore[misc]
    """
    Collaborative whiteboard document representing the consolidated state (snapshot)
    of a shared Yjs canvas.
    """

    __tablename__ = "canvas_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), default="Untitled Whiteboard", nullable=False)
    snapshot: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, default=b"")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    updates: Mapped[list[CanvasUpdate]] = relationship(
        "CanvasUpdate",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="CanvasUpdate.sequence_number",
    )


class CanvasUpdate(Base):  # type: ignore[misc]
    """
    Append-only log of Yjs binary CRDT delta updates applied to a canvas document.
    Sequenced monotonically per document.
    """

    __tablename__ = "canvas_updates"
    __table_args__ = (
        UniqueConstraint("document_id", "sequence_number", name="uq_canvas_updates_doc_seq"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("canvas_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence_number: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    document: Mapped[CanvasDocument] = relationship("CanvasDocument", back_populates="updates")

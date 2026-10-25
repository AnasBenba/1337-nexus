import uuid
from datetime import UTC, datetime

from pgvector.sqlalchemy import Vector  # type: ignore[import-untyped]
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.ai.config import EMBEDDING_DIMENSIONS
from app.shared.models import Base
from app.user.pitches.schemas import PitchCategory, PitchStatus


class Pitch(Base):  # type: ignore[misc]
    __tablename__ = "pitches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    rendered_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[PitchCategory] = mapped_column(
        SQLEnum(
            PitchCategory,
            name="pitchcategory",
            values_callable=lambda x: [e.name for e in x],
        ),
        nullable=False,
    )
    status: Mapped[PitchStatus] = mapped_column(
        SQLEnum(
            PitchStatus,
            name="pitchstatus",
            values_callable=lambda x: [e.name for e in x],
        ),
        default=PitchStatus.DRAFT,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS), nullable=True
    )
    author_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )

    @property
    def state(self) -> PitchStatus:
        return self.status

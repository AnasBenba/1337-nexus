import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID

from app.shared.ai.config import EMBEDDING_DIMENSIONS
from app.shared.models import Base
from app.user.pitches.schemas import PitchCategory, PitchStatus


class PitchVote(Base):
    __tablename__ = "pitch_votes"
    __table_args__ = (
        UniqueConstraint("pitch_id", "user_id", name="uq_pitch_votes_pitch_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pitch_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pitches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_upvote = Column(Boolean, nullable=False)


class Pitch(Base):
    __tablename__ = "pitches"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False, index=True)
    content = Column(Text, nullable=False)
    rendered_content = Column(Text)
    description = Column(Text)
    category = Column(Enum(PitchCategory), nullable=False)
    status = Column(
        Enum(PitchStatus),
        default=PitchStatus.DRAFT,
        nullable=False,
        server_default=PitchStatus.DRAFT.value,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    embedding = Column(Vector(EMBEDDING_DIMENSIONS))
    author_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    @property
    def state(self) -> PitchStatus:
        return self.status

import uuid
from sqlalchemy import Column, DateTime, String, Text, Enum, func
from sqlalchemy.dialects.postgresql import UUID
from app.shared.models import Base
from .schemas import PitchCategory, PitchStatus
from pgvector.sqlalchemy import Vector
from app.shared.ai.config import EMBEDDING_DIMENSIONS

class Pitch(Base):
    __tablename__ = "pitches" 

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    title = Column(String, index=True)
    content = Column(Text)  
    rendered_content = Column(Text)
    description = Column(Text)
    category = Column(Enum(PitchCategory))
    status = Column(Enum(PitchStatus), default=PitchStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    embedding = Column(Vector(EMBEDDING_DIMENSIONS))
    # author_id = Column(Integer, index=True)

    @property
    def state(self) -> PitchStatus:
        return self.status
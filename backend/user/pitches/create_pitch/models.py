import uuid
from sqlalchemy import Column, Integer, String, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.shared.models import Base
from .schemas import PitchCategory, PitchStatus

class Pitch(Base):
    __tablename__ = "pitches" 

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    title = Column(String, index=True)
    content = Column(Text)  
    description = Column(Text)
    category = Column(Enum(PitchCategory))
    status = Column(Enum(PitchStatus), default=PitchStatus.DRAFT)
    # author_id = Column(Integer, index=True)

    @property
    def state(self) -> PitchStatus:
        return self.status
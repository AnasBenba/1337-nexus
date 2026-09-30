from sqlalchemy import Column, String, Text, Enum
from app.shared.models import BaseModel
from .schemas import PitchCategory, PitchStatus

class Pitch(BaseModel):
    __tablename__ = "pitches" 

    title = Column(String, index=True)
    content = Column(Text)  
    description = Column(Text)
    category = Column(Enum(PitchCategory))
    status = Column(Enum(PitchStatus), default=PitchStatus.DRAFT)
    author_id = Column(String, index=True)
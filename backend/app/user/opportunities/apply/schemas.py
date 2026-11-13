from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ApplyRequest(BaseModel):
    message: str | None = Field(default=None, max_length=5000)
    candidate_skills: list[str] = Field(default_factory=list)


class ApplyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    opportunity_id: UUID
    user_id: int
    status: str
    message: str | None
    candidate_skills: list[str]
    created_at: datetime
    updated_at: datetime

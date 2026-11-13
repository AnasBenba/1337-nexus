from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UpdateApplicationStatusRequest(BaseModel):
    status: str


class ReviewedApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    opportunity_id: UUID
    user_id: UUID
    user_login: str | None = None
    user_fullname: str | None = None
    status: str
    message: str | None
    candidate_skills: list[str]
    match_score: float = 0.0
    created_at: datetime
    updated_at: datetime

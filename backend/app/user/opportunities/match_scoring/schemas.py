from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MatchScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    opportunity_id: UUID
    user_id: UUID
    status: str
    message: str | None
    candidate_skills: list[str]
    match_score: float = 0.0
    created_at: datetime
    updated_at: datetime

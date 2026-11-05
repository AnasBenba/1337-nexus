from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OpportunityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    description: str
    required_skills: list[str]
    status: str
    created_at: datetime
    updated_at: datetime
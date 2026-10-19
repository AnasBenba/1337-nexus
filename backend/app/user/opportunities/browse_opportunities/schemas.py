from datetime import datetime

from pydantic import BaseModel, ConfigDict


class OpportunityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    title: str
    description: str
    required_skills: list[str]
    status: str
    created_at: datetime
    updated_at: datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreateOpportunityRequest(BaseModel):
    project_id: UUID
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    required_skills: list[str] = Field(default_factory=list)
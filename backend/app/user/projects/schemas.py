from uuid import UUID

from pydantic import BaseModel, Field


class ProjectRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)


class ProjectUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1)


class ProjectStatusRequest(BaseModel):
    pass


class ProjectResponse(BaseModel):
    id: UUID
    owner_id: int
    title: str
    description: str
    status: str

    model_config = {"from_attributes": True}

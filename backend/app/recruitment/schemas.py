"""Validated API contracts for the recruitment vertical slice."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

from app.recruitment.models import ApplicationStatus, RecruitmentStatus


NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateRecruitmentPost(BaseModel):
    """Input for publishing a role/project opportunity."""

    title: NonEmptyText = Field(max_length=160)
    description: NonEmptyText = Field(max_length=10_000)
    skills: list[NonEmptyText] = Field(default_factory=list, max_length=30)


class UpdateRecruitmentPost(BaseModel):
    """Partial edit; omitted fields are left unchanged."""

    title: NonEmptyText | None = Field(default=None, max_length=160)
    description: NonEmptyText | None = Field(default=None, max_length=10_000)
    skills: list[NonEmptyText] | None = Field(default=None, max_length=30)
    status: RecruitmentStatus | None = None


class RecruitmentPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    founder_id: UUID
    title: str
    description: str
    skills: list[str]
    status: RecruitmentStatus
    created_at: datetime


class ApplyRequest(BaseModel):
    message: NonEmptyText = Field(max_length=5_000)
    skills: list[NonEmptyText] = Field(default_factory=list, max_length=30)


class ApplicationReviewRequest(BaseModel):
    decision: ApplicationStatus


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    recruitment_post_id: UUID
    applicant_id: UUID
    message: str
    skills: list[str]
    status: ApplicationStatus
    created_at: datetime

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RefineRequest(BaseModel):
    """Optional payload for requesting a pitch critique."""

    pass


class RefineResponse(BaseModel):
    job_id: UUID
    status: str
    base_hash: str
    message: str


class SuggestionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    field: str
    section_label: str
    severity: str
    title: str
    original_excerpt: str
    suggested_text: str
    rationale: str
    status: str
    applied_at: datetime | None = None


class CritiqueSummary(BaseModel):
    executive_assessment: str
    strengths: list[str] = Field(default_factory=list)


class RefineStatusResponse(BaseModel):
    job_id: UUID
    status: str  # pending, running, succeeded, failed
    error_message: str | None = None
    summary: CritiqueSummary | None = None
    suggestions: list[SuggestionItem] = Field(default_factory=list)
    critique_created_at: datetime | None = None
    version_token: str | None = None
    is_stale: bool = False


class ApplySuggestionRequest(BaseModel):
    version_token: str


class ApplySuggestionResponse(BaseModel):
    suggestion_id: UUID
    status: str
    new_version_token: str
    applied_field: str
    message: str


class DismissSuggestionResponse(BaseModel):
    suggestion_id: UUID
    status: str

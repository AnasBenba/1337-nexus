"""
Pydantic v2 schemas and data transfer objects for the copilot ask flow.
Compatible with DBML Table copilot_threads & Table copilot_messages.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from pydantic import BaseModel, Field

from app.models.copilot import CopilotMessage
from app.user.copilot.retrieve_curriculum.schemas import ChunkResult


class AskRequest(BaseModel):
    """Input payload for POST /api/v1/copilot/ask."""

    question: str = Field(
        ...,
        min_length=1,
        description="The user's question to the AI copilot.",
    )
    k: int = Field(
        default=8,
        ge=1,
        le=20,
        description="Number of curriculum chunks to retrieve for context (default 8, max 20).",
    )
    thread_id: uuid.UUID | None = Field(
        default=None,
        description="Optional thread ID. A new thread is initialized if omitted.",
    )
    conversation_id: uuid.UUID | None = Field(
        default=None,
        description="Alias for thread_id.",
    )
    project_id: uuid.UUID | None = Field(
        default=None,
        description="Optional project ID associated with the copilot thread.",
    )
    subject_slug: str | None = Field(
        default=None,
        description="Optional subject slug (e.g. push_swap) scoping the thread.",
    )
    user_id: uuid.UUID | None = Field(
        default=None,
        description="Optional user ID owning the thread and messages.",
    )

    def get_resolved_thread_id(self) -> uuid.UUID | None:
        """Returns thread_id or conversation_id if either was provided."""
        return self.thread_id or self.conversation_id


@dataclass(frozen=True)
class PreStreamResult:
    """
    Output data transfer object for Phase 1: Pre-Stream Transaction & Retrieval.
    Contains the initialized thread ID, persisted messages, and retrieved chunks.
    """

    thread_id: uuid.UUID
    user_message: CopilotMessage
    assistant_message: CopilotMessage
    context_chunks: list[ChunkResult]

    @property
    def conversation_id(self) -> uuid.UUID:
        """Backward-compatibility alias."""
        return self.thread_id

    @property
    def user_message_id(self) -> uuid.UUID:
        return self.user_message.id

    @property
    def assistant_message_id(self) -> uuid.UUID:
        return self.assistant_message.id

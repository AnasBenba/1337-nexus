"""
Pydantic v2 schemas for the curriculum retrieval service.

Request:  RetrievalQuery  - the user question + optional k override
Response: ChunkResult     - a single ranked chunk with citation metadata
          RetrievalResult - the full ranked list returned by the service
"""
import uuid

from pydantic import BaseModel, Field


class RetrievalQuery(BaseModel):
    """Input to the retrieve-curriculum service."""

    query: str = Field(
        ...,
        min_length=1,
        description="Natural-language question from the copilot user.",
    )
    k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of top chunks to return (default 5, max 20).",
    )


class ChunkResult(BaseModel):
    """A single retrieved curriculum chunk with citation metadata."""

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    subject_slug: str
    ordinal: int = Field(
        description="chunk_index - position within the source document."
    )
    snippet: str = Field(
        description="The raw text content of the chunk (<= 800 tokens)."
    )
    distance: float = Field(
        description="Cosine distance from query vector (lower = more relevant)."
    )


class RetrievalResult(BaseModel):
    """Ordered list of the top-K most relevant chunks for a given query."""

    query: str
    chunks: list[ChunkResult]

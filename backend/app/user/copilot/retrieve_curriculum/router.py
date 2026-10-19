"""
FastAPI router for the retrieve-curriculum endpoint.

Endpoint:  POST /api/v1/copilot/retrieve-curriculum
Tags:      copilot

This router is the HTTP boundary layer — intentionally thin.
All business logic lives in service.py; all DB access in repository.py.

Dependency injection:
  - db  : async SQLAlchemy session via get_db_session()
  - ai  : AIProvider via get_ai_provider() (stub by default, real LLM later)
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.shared.ai.client import get_ai_provider
from app.shared.ai.provider import AIProvider

from .schemas import RetrievalQuery, RetrievalResult
from .service import retrieve_curriculum

router = APIRouter(
    prefix="/api/v1/copilot",
    tags=["copilot"],
)


@router.post(
    "/retrieve-curriculum",
    response_model=RetrievalResult,
    summary="Semantic curriculum chunk retrieval",
    description=(
        "Embeds the query text and returns the top-K most semantically "
        "relevant curriculum chunks from the pgvector HNSW index, "
        "ordered by ascending cosine distance. Each chunk includes "
        "citation metadata (subject_slug, ordinal, snippet, distance)."
    ),
)
async def retrieve_curriculum_endpoint(
    body: RetrievalQuery,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    ai: Annotated[AIProvider, Depends(get_ai_provider)],
) -> RetrievalResult:
    return await retrieve_curriculum(body, db, ai)

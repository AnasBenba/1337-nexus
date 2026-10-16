"""
Service layer: retrieve the most relevant curriculum chunks for a given query.

Responsibility chain:
    1. Embed the user query via AIProvider.embed()
    2. Delegate the vector search to the repository layer
    3. Marshal raw DB rows -> validated Pydantic response models
    4. Return a RetrievalResult ready for the copilot generator

This module is the entry point declared in the ticket description.
"""
from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.ai.config import EMBEDDING_DIMENSIONS
from app.shared.ai.provider import AIProvider

from .repository import find_nearest_chunks
from .schemas import ChunkResult, RetrievalQuery, RetrievalResult

logger = logging.getLogger(__name__)


async def retrieve_curriculum(
    query: RetrievalQuery,
    db: AsyncSession,
    ai: AIProvider,
) -> RetrievalResult:
    """
    Return the top-K curriculum chunks most semantically similar to query.query.

    Args:
        query: Validated RetrievalQuery (text + optional k override).
        db:    Async database session.
        ai:    AIProvider instance used to embed the query text.

    Returns:
        RetrievalResult containing an ordered list of ChunkResult objects
        with distance scores and citation metadata.

    Raises:
        ValueError: If the AI provider returns a vector of unexpected dimension.
    """
    logger.info("retrieve_curriculum called | query=%r k=%d", query.query, query.k)

    # 1. Embed the query -------------------------------------------------------
    vectors: list[list[float]] = await ai.embed([query.query])
    query_vector = vectors[0]

    if len(query_vector) != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"Query embedding dimension mismatch: "
            f"expected {EMBEDDING_DIMENSIONS}, got {len(query_vector)}"
        )

    # 2. Vector search ---------------------------------------------------------
    raw_rows = await find_nearest_chunks(db, query_vector, k=query.k)

    # 3. Marshal rows -> Pydantic models ---------------------------------------
    chunks: list[ChunkResult] = []
    for row in raw_rows:
        chunks.append(
            ChunkResult(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                subject_slug=row["subject_slug"],
                ordinal=row["ordinal"] if row["ordinal"] is not None else 0,
                snippet=row["snippet"],
                distance=float(row["distance"]),
            )
        )

    logger.info(
        "retrieve_curriculum done | returned %d chunks (of k=%d requested)",
        len(chunks),
        query.k,
    )

    return RetrievalResult(query=query.query, chunks=chunks)

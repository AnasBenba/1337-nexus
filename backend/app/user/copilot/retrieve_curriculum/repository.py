"""
Repository layer: raw SQLAlchemy Core query against the pgvector HNSW index.

Uses the `<=>` cosine-distance operator so PostgreSQL can leverage the HNSW
index on `curriculum_chunks.embedding` without a full sequential scan.

Query design:
  - JOIN curriculum_chunks -> subject_documents -> subjects to resolve
    subject_slug in a single round-trip.
  - ORDER BY distance ASC (closest first), LIMIT k.
  - Returns plain dicts so the service layer stays ORM-agnostic.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------
# The cast `::vector` is required because SQLAlchemy passes Python lists as
# PostgreSQL arrays; pgvector needs an explicit vector cast to use the index.
# ---------------------------------------------------------------------------
_RETRIEVAL_SQL = text("""
    SELECT
        cc.id                                        AS chunk_id,
        cc.document_id                               AS document_id,
        cc.chunk_index                               AS ordinal,
        cc.content                                   AS snippet,
        cc.chunk_metadata                            AS chunk_metadata,
        s.slug                                       AS subject_slug,
        cc.embedding <=> CAST(:query_vec AS vector)  AS distance
    FROM  curriculum_chunks  cc
    JOIN  subject_documents  sd ON sd.id = cc.document_id
    JOIN  subjects           s  ON s.id  = sd.subject_id
    ORDER BY distance ASC
    LIMIT :k
""")


async def find_nearest_chunks(
    db: AsyncSession,
    query_vector: list[float],
    k: int = 5,
) -> list[dict[str, Any]]:
    """
    Execute a cosine-distance ANN search against the HNSW index.

    Args:
        db:           Async SQLAlchemy session (injected by the service).
        query_vector: Dense embedding of the user query (must be 1536-dim).
        k:            Number of nearest neighbours to return.

    Returns:
        List of dicts ordered by ascending cosine distance.
        Each dict contains: chunk_id, document_id, ordinal, snippet,
        chunk_metadata, subject_slug, distance.
    """
    # pgvector expects the vector literal as a bracketed float list string
    vec_literal = "[" + ",".join(f"{v:.8f}" for v in query_vector) + "]"

    logger.debug("Executing HNSW ANN retrieval k=%d", k)

    result = await db.execute(
        _RETRIEVAL_SQL,
        {"query_vec": vec_literal, "k": k},
    )

    rows = result.mappings().all()
    logger.debug("Retrieved %d chunks from pgvector", len(rows))
    return [dict(row) for row in rows]

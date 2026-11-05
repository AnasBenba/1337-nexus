from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import AIJob


async def enqueue_job(
    session: AsyncSession,
    job_type: str,
    payload: dict[str, Any] | None = None,
    max_attempts: int = 3,
) -> AIJob:
    """
    Transactionally enqueue a background job into the ai_jobs queue.

    Parameters:
        session: Active SQLAlchemy AsyncSession.
        job_type: Registered job type identifier.
        payload: JSON-serializable dictionary payload for the job executor.
        max_attempts: Maximum retry attempts before permanent failure.

    Returns:
        The newly created AIJob model instance.
    """
    job = AIJob(
        id=uuid.uuid4(),
        job_type=job_type,
        payload=payload if payload is not None else {},
        max_attempts=max_attempts,
        status="pending",
    )
    session.add(job)
    await session.flush()
    return job

"""
Service layer for the copilot ask workflow.

Phase 1: Pre-Stream Transaction & Retrieval (< 50ms)
- Opens a dedicated short-lived DB session using async_session_factory.
- Ensures a parent copilot_threads row exists (or creates a new one).
- Calls retrieve_curriculum to fetch top-K ChunkResult items from pgvector.
- Inserts user's message into copilot_messages (role="user", content=body.question).
- Inserts assistant's placeholder row into copilot_messages:
    role="assistant", content="", status="streaming", serialized context_chunks.
- Commits and exits the session immediately to release the connection to the pool.
"""
from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.models.copilot import CopilotMessage, CopilotThread
from app.shared.ai.provider import AIProvider
from app.user.copilot.retrieve_curriculum.schemas import RetrievalQuery
from app.user.copilot.retrieve_curriculum.service import retrieve_curriculum

from .schemas import AskRequest, PreStreamResult

logger = logging.getLogger(__name__)

AsyncSessionFactory = Callable[[], AsyncSession]


async def pre_stream_transaction(
    body: AskRequest,
    ai: AIProvider,
    async_session_factory: AsyncSessionFactory = SessionLocal,
) -> PreStreamResult:
    """
    Execute Phase 1 of the Copilot Ask flow:
    Perform fast curriculum retrieval via pgvector, ensure thread exists,
    and persist user & placeholder assistant messages in a short DB transaction (< 50ms).

    Args:
        body: Validated AskRequest with question, k, and optional thread/user/project IDs.
        ai: Configured AIProvider for embedding queries.
        async_session_factory: Callable returning an AsyncSession (defaults to SessionLocal).

    Returns:
        PreStreamResult containing the thread ID, persisted messages, and retrieved chunks.
    """
    requested_thread_id = body.get_resolved_thread_id()
    thread_id = requested_thread_id or uuid.uuid4()
    user_id = body.user_id
    project_id = body.project_id
    subject_slug = body.subject_slug

    logger.info(
        "Starting pre-stream retrieval | question=%r k=%d thread_id=%s",
        body.question,
        body.k,
        thread_id,
    )

    async with async_session_factory() as db:
        # 1. Ensure the parent copilot_threads record exists
        thread = None
        if requested_thread_id is not None:
            thread = await db.get(CopilotThread, requested_thread_id)

        if thread is None:
            thread = CopilotThread(
                id=thread_id,
                user_id=user_id,
                project_id=project_id,
                subject_slug=subject_slug,
                title=body.question[:100],
            )
            db.add(thread)

        # 2. Retrieve top-K curriculum chunks via pgvector
        retrieval_query = RetrievalQuery(query=body.question, k=body.k)
        retrieval_result = await retrieve_curriculum(retrieval_query, db, ai)
        context_chunks = retrieval_result.chunks

        # 3. Serialize retrieved chunks for JSONB storage
        serialized_chunks: list[dict[str, Any]] = [
            chunk.model_dump(mode="json") if hasattr(chunk, "model_dump") else dict(chunk)
            for chunk in context_chunks
        ]

        # 4. Insert the user's message
        user_message = CopilotMessage(
            id=uuid.uuid4(),
            thread_id=thread_id,
            role="user",
            content=body.question,
            status="completed",
        )
        db.add(user_message)

        # 5. Insert the assistant's placeholder row
        assistant_message = CopilotMessage(
            id=uuid.uuid4(),
            thread_id=thread_id,
            role="assistant",
            content="",
            status="streaming",
            context_chunks=serialized_chunks,
        )
        db.add(assistant_message)

        # 6. Commit immediately so the DB connection returns to the pool
        await db.commit()

    logger.info(
        "Pre-stream retrieval and transaction committed | user_msg=%s assistant_msg=%s chunks=%d",
        user_message.id,
        assistant_message.id,
        len(context_chunks),
    )

    return PreStreamResult(
        thread_id=thread_id,
        user_message=user_message,
        assistant_message=assistant_message,
        context_chunks=context_chunks,
    )


# Alias for explicit naming compatibility
prepare_copilot_stream = pre_stream_transaction

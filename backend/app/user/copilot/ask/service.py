"""
Service layer for the copilot ask workflow.

Phase 1: Pre-Stream Transaction & Retrieval (< 50ms)
- Opens a dedicated short-lived DB session using async_session_factory.
- Ensures a parent copilot_threads row exists (or creates a new one).
- Calls retrieve_curriculum to fetch top-K ChunkResult items from pgvector.
- Inserts user's message and assistant placeholder into copilot_messages.
- Commits and exits immediately so the DB connection returns to the pool.

Phase 2: Prompt Assembly & Token Streaming (0 DB connections held)
- Yields the meta SSE frame (thread_id, message_id, citations) immediately.
- Builds a grounded prompt injecting retrieved curriculum snippets.
- Streams tokens from the AI provider, yielding delta SSE frames.
- Accumulates the full response in an in-memory buffer.

Phase 3: Post-Stream Transaction (< 20ms)
- Opens a fresh DB session after streaming completes (or on failure).
- Updates the assistant message row with the full content, token count,
  and status (completed or failed).
- Commits and yields the final done SSE frame.
"""
from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncGenerator, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.models.copilot import CopilotMessage, CopilotThread
from app.shared.ai.provider import AIProvider
from app.user.copilot.retrieve_curriculum.schemas import ChunkResult, RetrievalQuery
from app.user.copilot.retrieve_curriculum.service import retrieve_curriculum

from .schemas import AskRequest, PreStreamResult

logger = logging.getLogger(__name__)

AsyncSessionFactory = Callable[[], AsyncSession]

_CONTEXT_WINDOW = 6000  # max chars of snippet context injected into the prompt


# ---------------------------------------------------------------------------
# SSE frame helpers
# ---------------------------------------------------------------------------


def format_sse(event: str, data: dict[str, Any]) -> str:
    """Format a payload as a standard Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _build_citations(chunks: list[ChunkResult]) -> list[dict[str, Any]]:
    """Convert ChunkResult list into citation objects for the meta frame."""
    return [
        {
            "chunk_id": str(c.chunk_id),
            "subject_slug": c.subject_slug,
            "ordinal": c.ordinal,
            "distance": round(c.distance, 4),
        }
        for c in chunks
    ]


def _build_grounded_prompt(
    question: str, chunks: list[ChunkResult]
) -> list[dict[str, str]]:
    """
    Assemble the LLM messages list with curriculum context injected.

    The system message instructs the model to answer strictly from
    the provided 1337 curriculum excerpts and never hallucinate.
    """
    context_parts: list[str] = []
    remaining = _CONTEXT_WINDOW
    for chunk in chunks:
        snippet = chunk.snippet.strip()
        label = f"[{chunk.subject_slug} -- excerpt {chunk.ordinal}]"
        block = f"{label}\n{snippet}"
        if len(block) > remaining:
            context_parts.append(block[:remaining])
            break
        context_parts.append(block)
        remaining -= len(block) + 2  # account for separator newlines

    curriculum_context = "\n\n---\n\n".join(context_parts)

    system_message = (
        "You are the 1337 / 42 Network AI Copilot. "
        "You MUST answer the student's question using ONLY the curriculum excerpts "
        "provided below. Do NOT invent information or draw on outside knowledge. "
        "If the answer is not contained in the excerpts, say so clearly.\n\n"
        f"## Curriculum Context\n\n{curriculum_context}"
    )

    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": question},
    ]


# ---------------------------------------------------------------------------
# Phase 1: Pre-Stream Transaction & Retrieval
# ---------------------------------------------------------------------------


async def pre_stream_transaction(
    body: AskRequest,
    ai: AIProvider,
    async_session_factory: AsyncSessionFactory | None = None,
) -> PreStreamResult:
    """
    Execute Phase 1 of the Copilot Ask flow.

    Perform fast curriculum retrieval via pgvector, ensure the thread exists,
    and persist user & placeholder assistant messages in a short DB transaction
    (< 50ms). The DB connection is released before any AI inference begins.

    Args:
        body: Validated AskRequest with question, k, and optional thread/user/project IDs.
        ai: Configured AIProvider for embedding queries.
        async_session_factory: Callable returning an AsyncSession (defaults to SessionLocal).

    Returns:
        PreStreamResult containing the thread ID, persisted messages, and retrieved chunks.
    """
    requested_thread_id = body.get_resolved_thread_id()
    thread_id = requested_thread_id or uuid.uuid4()
    if async_session_factory is None:
        async_session_factory = SessionLocal

    user_id = body.user_id
    project_id = body.project_id
    subject_slug = body.subject_slug

    logger.info(
        "Phase 1 start | question=%r k=%d thread_id=%s",
        body.question,
        body.k,
        thread_id,
    )

    async with async_session_factory() as db:
        # 1. Ensure the parent copilot_threads record exists
        thread: CopilotThread | None = None
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
            chunk.model_dump(mode="json") for chunk in context_chunks
        ]

        # 4. Insert the user message
        user_message = CopilotMessage(
            id=uuid.uuid4(),
            thread_id=thread_id,
            role="user",
            content=body.question,
            status="completed",
        )
        db.add(user_message)

        # 5. Insert the assistant placeholder row
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
        "Phase 1 done | user_msg=%s assistant_msg=%s chunks=%d",
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


# ---------------------------------------------------------------------------
# Phase 2 + 3: Stream Copilot Answer (main generator consumed by router)
# ---------------------------------------------------------------------------


async def stream_copilot_answer(
    body: AskRequest,
    ai: AIProvider,
    async_session_factory: AsyncSessionFactory | None = None,
) -> AsyncGenerator[str, None]:
    """
    Full Copilot Ask generator: Phase 1 -> Phase 2 -> Phase 3.

    Yields standard SSE frames in order:
        1. event: meta  -- metadata and citation list (emitted immediately, before tokens)
        2. event: delta -- one frame per streamed LLM token
        3. event: done  -- final status, total token count, message_id

    No database connection is held open during Phase 2 streaming.

    Args:
        body: Validated AskRequest.
        ai:   Configured AIProvider (Gemini or stub).
        async_session_factory: Callable returning an AsyncSession.
    """
    if async_session_factory is None:
        async_session_factory = SessionLocal

    # ---- Phase 1 -------------------------------------------------------
    state = await pre_stream_transaction(body, ai, async_session_factory)

    assistant_msg_id = state.assistant_message.id
    citations = _build_citations(state.context_chunks)

    # ---- Phase 2 -------------------------------------------------------
    # Emit meta frame immediately before the first LLM token.
    yield format_sse(
        "meta",
        {
            "thread_id": str(state.thread_id),
            "message_id": str(assistant_msg_id),
            "citations": citations,
        },
    )

    messages = _build_grounded_prompt(body.question, state.context_chunks)

    full_response: list[str] = []
    final_status = "completed"

    try:
        stream_fn = getattr(ai, "stream_chat", None) or getattr(ai, "stream_complete", None)
        if stream_fn is None:
            raise AttributeError("AI provider must implement stream_chat or stream_complete")
        async for token in stream_fn(messages):
            full_response.append(token)
            yield format_sse("delta", {"content": token})

    except Exception:
        logger.exception(
            "Streaming failed | assistant_msg=%s thread=%s",
            assistant_msg_id,
            state.thread_id,
        )
        final_status = "failed"

    # ---- Phase 3 -------------------------------------------------------
    # Open a fresh short-lived session to record the completed response.
    full_content = "".join(full_response)
    token_count = len(full_content.split())

    try:
        async with async_session_factory() as db:
            assistant_row = await db.get(CopilotMessage, assistant_msg_id)
            if assistant_row is not None:
                assistant_row.content = full_content
                assistant_row.status = final_status
                assistant_row.tokens = token_count
            await db.commit()
    except Exception:
        logger.exception(
            "Phase 3 DB update failed | assistant_msg=%s",
            assistant_msg_id,
        )
        final_status = "failed"

    logger.info(
        "Phase 3 done | assistant_msg=%s status=%s tokens=%d",
        assistant_msg_id,
        final_status,
        token_count,
    )

    yield format_sse(
        "done",
        {
            "message_id": str(assistant_msg_id),
            "status": final_status,
            "tokens": token_count,
        },
    )


# Alias kept for Phase 1 callers and existing tests
prepare_copilot_stream = pre_stream_transaction

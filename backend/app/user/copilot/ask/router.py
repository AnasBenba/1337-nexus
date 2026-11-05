"""
Router for POST /api/v1/copilot/ask.

Wraps the stream_copilot_answer generator in a StreamingResponse with
anti-buffering headers so neither Uvicorn nor Nginx/Docker buffers SSE chunks.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.shared.ai.client import get_ai_provider
from app.shared.ai.provider import AIProvider

from .schemas import AskRequest
from .service import stream_copilot_answer

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])


@router.post("/ask")
async def ask_copilot_endpoint(
    body: AskRequest,
    ai: AIProvider = Depends(get_ai_provider),
) -> StreamingResponse:
    """
    Ask the AI copilot a question grounded in retrieved curriculum context.

    Returns a Server-Sent Events stream with three event types:
    - **meta**: Emitted immediately with thread_id, message_id, and citation list.
    - **delta**: One frame per streamed LLM token.
    - **done**: Final frame with status and total token count.
    """
    event_generator = stream_copilot_answer(body=body, ai=ai)
    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Prevents Nginx from buffering SSE chunks
        },
    )


# Alias for backward compatibility
ask_copilot = ask_copilot_endpoint

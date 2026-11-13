from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.canvas import CanvasDocument, CanvasUpdate

logger = logging.getLogger(__name__)

MAX_CANVAS_PAYLOAD_BYTES = 256 * 1024


def validate_canvas_payload(data: Any) -> bytes:
    """Validate that canvas payload is binary and under 256 KB."""
    if not isinstance(data, (bytes, bytearray)):
        msg = f"Expected binary payload (bytes/bytearray), got {type(data).__name__}"
        raise ValueError(msg)

    raw_bytes = bytes(data)
    if len(raw_bytes) > MAX_CANVAS_PAYLOAD_BYTES:
        msg = f"Payload size {len(raw_bytes)} bytes exceeds limit {MAX_CANVAS_PAYLOAD_BYTES}"
        raise ValueError(msg)

    return raw_bytes


async def record_canvas_update(
    db: AsyncSession,
    document_id: uuid.UUID,
    data: bytes | bytearray,
    auto_compact: bool = True,
    compaction_threshold: int = 500,
) -> CanvasUpdate:
    """
    Atomically append a binary delta update to canvas_updates with a strictly
    monotonic sequence number. Optionally triggers snapshot compaction if updates
    reach the compaction threshold.
    """
    binary_data = validate_canvas_payload(data)

    # 1. Lock document row to prevent concurrent sequence number race conditions
    doc_stmt = select(CanvasDocument).where(CanvasDocument.id == document_id).with_for_update()
    doc_res = await db.execute(doc_stmt)
    doc = doc_res.scalar_one_or_none()

    if doc is None:
        # Auto-create if document does not exist yet
        doc = CanvasDocument(id=document_id, snapshot=b"")
        db.add(doc)
        await db.flush()

    # 2. Compute next monotonic sequence number
    seq_stmt = select(func.coalesce(func.max(CanvasUpdate.sequence_number), 0) + 1).where(
        CanvasUpdate.document_id == document_id
    )

    seq_res = await db.execute(seq_stmt)
    next_sequence = int(seq_res.scalar_one())

    # 3. Create update record
    update = CanvasUpdate(
        document_id=document_id,
        sequence_number=next_sequence,
        data=binary_data,
    )
    db.add(update)
    await db.commit()
    await db.refresh(update)

    logger.debug(
        "Recorded canvas update for %s: seq=%d size=%d bytes",
        document_id,
        next_sequence,
        len(binary_data),
    )

    # 4. Trigger compaction if threshold is reached
    if auto_compact:
        from app.collaboration.canvas.compact_document.service import maybe_compact_canvas_document

        await maybe_compact_canvas_document(db, document_id, threshold=compaction_threshold)

    return update

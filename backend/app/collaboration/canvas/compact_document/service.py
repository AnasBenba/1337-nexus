from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import pycrdt
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.canvas import CanvasDocument, CanvasUpdate

logger = logging.getLogger(__name__)

DEFAULT_COMPACTION_THRESHOLD: int = 500


@dataclass(frozen=True)
class CompactionResult:
    """Result of a canvas document snapshot compaction operation."""

    document_id: uuid.UUID
    watermark: int
    compacted_updates_count: int
    snapshot_size_bytes: int
    purged: bool


def get_canvas_advisory_lock_key(document_id: uuid.UUID) -> int:
    """
    Derive a deterministic signed 64-bit integer from a UUID for Postgres advisory locks.
    Postgres `pg_advisory_xact_lock` expects a signed bigint (-2^63 to 2^63 - 1).
    """
    return int.from_bytes(document_id.bytes[:8], byteorder="big", signed=True)


def merge_updates_with_snapshot(existing_snapshot: bytes, updates: list[bytes]) -> bytes:
    """
    Consolidate an existing Yjs binary snapshot and a sequence of incremental updates
    into a single cohesive snapshot using pycrdt.
    """
    y_doc: pycrdt.Doc[Any] = pycrdt.Doc()
    if existing_snapshot:
        y_doc.apply_update(existing_snapshot)

    for update_data in updates:
        if update_data:
            y_doc.apply_update(update_data)

    return bytes(y_doc.get_update())


async def compact_canvas_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    watermark: int | None = None,
) -> CompactionResult | None:
    """
    Perform snapshot compaction on a canvas document:
    1. Acquire a Postgres transaction-level advisory lock on the document.
    2. Read updates up to the watermark.
    3. Merge them into a new snapshot using pycrdt and update `canvas_documents.snapshot`.
    4. Safely purge updates at or below the watermark.
    """
    lock_key = get_canvas_advisory_lock_key(document_id)

    # 1. Acquire transaction-level advisory lock (non-blocking)
    res = await db.execute(
        text("SELECT pg_try_advisory_xact_lock(:key)"),
        {"key": lock_key},
    )
    acquired = res.scalar_one()
    if not acquired:
        logger.info(
            "Compaction for document %s already in progress by another worker. Skipping.",
            document_id,
        )
        return None

    # 2. Lock document row to ensure consistent snapshot reads and writes
    doc_stmt = select(CanvasDocument).where(CanvasDocument.id == document_id).with_for_update()
    doc_res = await db.execute(doc_stmt)
    doc = doc_res.scalar_one_or_none()

    if doc is None:
        logger.warning("Canvas document %s not found for compaction", document_id)
        return None

    # 3. Determine the watermark sequence number
    if watermark is None:
        wm_stmt = select(func.max(CanvasUpdate.sequence_number)).where(
            CanvasUpdate.document_id == document_id
        )
        wm_res = await db.execute(wm_stmt)
        max_seq = wm_res.scalar_one_or_none()
        if max_seq is None:
            # No updates exist in the log
            return CompactionResult(
                document_id=document_id,
                watermark=0,
                compacted_updates_count=0,
                snapshot_size_bytes=len(doc.snapshot or b""),
                purged=False,
            )
        watermark = int(max_seq)

    # 4. Fetch updates up to the watermark in monotonic sequence order
    updates_stmt = (
        select(CanvasUpdate)
        .where(
            CanvasUpdate.document_id == document_id,
            CanvasUpdate.sequence_number <= watermark,
        )
        .order_by(CanvasUpdate.sequence_number.asc())
    )
    updates_res = await db.execute(updates_stmt)
    updates = list(updates_res.scalars().all())

    if not updates:
        return CompactionResult(
            document_id=document_id,
            watermark=watermark,
            compacted_updates_count=0,
            snapshot_size_bytes=len(doc.snapshot or b""),
            purged=False,
        )

    # 5. Merge existing snapshot and incremental updates using pycrdt
    current_snapshot = bytes(doc.snapshot) if doc.snapshot else b""
    update_buffers = [bytes(u.data) for u in updates]
    new_snapshot = merge_updates_with_snapshot(current_snapshot, update_buffers)

    # 6. Write consolidated snapshot back to canvas_documents
    doc.snapshot = new_snapshot
    doc.updated_at = datetime.now(UTC)

    # 7. Safely purge updates at or below the watermark
    del_stmt = delete(CanvasUpdate).where(
        CanvasUpdate.document_id == document_id,
        CanvasUpdate.sequence_number <= watermark,
    )
    await db.execute(del_stmt)

    await db.commit()

    logger.info(
        "Compacted canvas %s: %d updates -> watermark=%d, snapshot_size=%d bytes",
        document_id,
        len(updates),
        watermark,
        len(new_snapshot),
    )

    return CompactionResult(
        document_id=document_id,
        watermark=watermark,
        compacted_updates_count=len(updates),
        snapshot_size_bytes=len(new_snapshot),
        purged=True,
    )


async def maybe_compact_canvas_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    threshold: int = DEFAULT_COMPACTION_THRESHOLD,
) -> CompactionResult | None:
    """
    Check if the number of uncompacted updates for a canvas document exceeds
    the threshold, and if so, trigger snapshot compaction.
    """
    count_stmt = select(func.count(CanvasUpdate.id)).where(CanvasUpdate.document_id == document_id)
    count_res = await db.execute(count_stmt)
    pending_count = int(count_res.scalar_one())

    if pending_count >= threshold:
        logger.info(
            "Canvas %s pending updates (%d) reached threshold (%d); triggering compaction.",
            document_id,
            pending_count,
            threshold,
        )
        return await compact_canvas_document(db, document_id)

    return None

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.canvas import CanvasDocument, CanvasUpdate

logger = logging.getLogger(__name__)


async def get_or_create_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    name: str = "Untitled Whiteboard",
) -> CanvasDocument:
    """
    Retrieve an existing canvas document or initialize a new empty one.
    """
    doc = await db.get(CanvasDocument, document_id)
    if doc is None:
        doc = CanvasDocument(
            id=document_id,
            name=name,
            snapshot=b"",
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        logger.info("Created new canvas document: %s", document_id)
    return doc


async def get_document_updates(
    db: AsyncSession,
    document_id: uuid.UUID,
    since_sequence: int = 0,
) -> list[CanvasUpdate]:
    """
    Retrieve all canvas updates for a document after a given sequence number.
    """
    from sqlalchemy import select

    stmt = (
        select(CanvasUpdate)
        .where(
            CanvasUpdate.document_id == document_id,
            CanvasUpdate.sequence_number > since_sequence,
        )
        .order_by(CanvasUpdate.sequence_number.asc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())

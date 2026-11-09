import uuid
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.ai.client import get_ai_provider
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCreate
from app.user.pitches.utils import render_and_sanitize


async def search_pitches(
    db: AsyncSession,
    query: str,
    limit: int = 10,
    category: str | None = None,
) -> list[Pitch]:
    ai = get_ai_provider()
    query_embedding = await ai.embed([query])
    db_query = select(Pitch)
    if category:
        db_query = db_query.where(Pitch.category == category)
    db_query = db_query.order_by(
        Pitch.embedding.cosine_distance(query_embedding[0])
    ).limit(limit)
    result = await db.execute(db_query)
    return list(result.scalars().all())


async def create_pitch(
    db: AsyncSession,
    pitch: PitchCreate,
    author_id: UUID,
) -> Pitch:
    ai = get_ai_provider()
    pitch_data = pitch.model_dump()
    embeddings = await ai.embed([pitch_data["content"]])
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])

    new_pitch = Pitch(**pitch_data, author_id=author_id)
    new_pitch.embedding = embeddings[0]
    db.add(new_pitch)
    await db.commit()
    await db.refresh(new_pitch)
    return new_pitch


async def get_all_pitches(db: AsyncSession) -> list[Pitch]:
    query = select(Pitch).order_by(Pitch.created_at.desc()).limit(40)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_one_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch


async def delete_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> dict[str, str]:
    pitch = await get_one_pitch(db=db, pitch_id=pitch_id)
    await db.delete(pitch)
    await db.commit()
    return {"message": "Pitch deleted successfully"}


async def update_pitch(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    pitch: PitchCreate,
    embedding: list[float] | None = None,
) -> Pitch:
    existing_pitch = await get_one_pitch(db=db, pitch_id=pitch_id)

    if embedding is None:
        ai = get_ai_provider()
        embeddings = await ai.embed([pitch.content])
        embedding = embeddings[0]

    pitch_data = pitch.model_dump()
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])
    for field, value in pitch_data.items():
        setattr(existing_pitch, field, value)
    existing_pitch.embedding = embedding

    await db.commit()
    await db.refresh(existing_pitch)
    return existing_pitch

import uuid
from collections.abc import Sequence

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.ai.client import get_ai_provider
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCategory, PitchCreate
from app.user.pitches.utils import render_and_sanitize


async def get_all_pitches(db: AsyncSession, limit: int = 40) -> Sequence[Pitch]:
    query = select(Pitch).order_by(Pitch.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_one_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch


async def search_pitches(
    db: AsyncSession,
    query: str,
    limit: int = 10,
    category: PitchCategory | str | None = None,
) -> Sequence[Pitch]:
    ai = get_ai_provider()
    query_embedding = await ai.embed([query])
    query_vector = query_embedding[0]
    db_query = select(Pitch)
    if category:
        db_query = db_query.where(Pitch.category == category)
    db_query = db_query.order_by(Pitch.embedding.cosine_distance(query_vector)).limit(limit)
    result = await db.execute(db_query)
    return result.scalars().all()


async def create_pitch(db: AsyncSession, pitch: PitchCreate, author_id: int | None = None) -> Pitch:
    ai = get_ai_provider()
    pitch_data = pitch.model_dump()
    embeddings = await ai.embed([pitch_data["content"]])
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])
    new_pitch = Pitch(**pitch_data, author_id=author_id)
    if embeddings:
        new_pitch.embedding = embeddings[0]
    db.add(new_pitch)
    await db.commit()
    await db.refresh(new_pitch)
    return new_pitch


async def update_pitch(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    pitch: PitchCreate,
    embedding: list[float] | None = None,
) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    existing_pitch = result.scalar_one_or_none()
    if existing_pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")

    pitch_data = pitch.model_dump()
    if embedding is not None:
        embeddings = [embedding]
    else:
        ai = get_ai_provider()
        embeddings = await ai.embed([pitch_data["content"]])

    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])

    for field, value in pitch_data.items():
        setattr(existing_pitch, field, value)
    if embeddings:
        existing_pitch.embedding = embeddings[0]

    await db.commit()
    await db.refresh(existing_pitch)
    return existing_pitch


async def delete_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> dict[str, str]:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")
    await db.delete(pitch)
    await db.commit()
    return {"message": "Pitch deleted successfully"}

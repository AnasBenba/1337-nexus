import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.ai.client import get_ai_provider
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCreate
from app.user.pitches.utils import render_and_sanitize


async def get_one_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch


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

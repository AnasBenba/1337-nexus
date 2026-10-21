import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Pitch
from .schemas import PitchCreate
from .utils import render_and_sanitize

async def create_pitch(db: AsyncSession, pitch: PitchCreate):
    # new_pitch = Pitch(**pitch.model_dump())
    pitch_data = pitch.model_dump()
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])
    new_pitch = Pitch(**pitch_data)
    db.add(new_pitch)
    await db.commit()
    await db.refresh(new_pitch)
    
    return new_pitch

async def get_all_pitches(db: AsyncSession):
    query = select(Pitch) .order_by(Pitch.created_at.desc()) .limit(40)

    result = await db.execute(query)

    return result.scalars().all()

async def get_one_pitch(db: AsyncSession, pitch_id: uuid.UUID):
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch

async def delete_pitch(db: AsyncSession, pitch_id: uuid.UUID):
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()

    if pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")

    await db.delete(pitch)
    await db.commit()
    return {"message": "Pitch deleted successfully"}

async def update_pitch(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    pitch: PitchCreate,
) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    existing_pitch = result.scalar_one_or_none()

    if existing_pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")
    pitch_data = pitch.model_dump()
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])

    for field, value in pitch_data.items():
        setattr(existing_pitch, field, value)
    await db.commit()
    await db.refresh(existing_pitch)
    return existing_pitch

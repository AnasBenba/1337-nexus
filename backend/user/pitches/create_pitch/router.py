from fastapi import APIRouter, Depends, HTTPException
import uuid
from app.core.db import get_db_session as get_db
from .schemas import PitchCreate, PitchResponse
from .service import create_pitch, get_all_pitches, delete_pitch, update_pitch, get_one_pitch
from app.core.db import get_db_session as get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.post("/pitches", response_model=PitchResponse)
async def create_pitch_endpoint(pitch: PitchCreate, db: AsyncSession = Depends(get_db)):
    return await create_pitch(db=db,pitch=pitch)

@router.get("/pitches", response_model=list[PitchResponse])
async def get_all_pitches_endpoint(db: AsyncSession = Depends(get_db)):
    return await get_all_pitches(db=db)

@router.get("/pitches/{pitch_id}", response_model=PitchResponse)
async def get_pitch_by_id(pitch_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    pitch = await get_one_pitch(db=db ,pitch_id=pitch_id)
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch

@router.put("/pitches/{pitch_id}", response_model=PitchResponse)
async def update_pitch_endpoint(
    pitch_id: uuid.UUID,
    pitch: PitchCreate,
    db: AsyncSession = Depends(get_db),
):
    return await update_pitch(db=db,   pitch_id=pitch_id, pitch=pitch)

@router.delete("/pitches/{pitch_id}")
async def delete_pitch_endpoint(pitch_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await delete_pitch(db=db, pitch_id=pitch_id)
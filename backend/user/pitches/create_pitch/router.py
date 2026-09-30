from fastapi import APIRouter
from schemas import PitchCreate, PitchResponse
from service import create_pitch, get_all_pitches, delete_pitch, update_pitch, get_one_pitch
from app.core.db import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.post("/pitches", response_model=PitchResponse)
def create_pitch_endpoint(pitch: PitchCreate, db: Session = Depends(get_db)):
    return create_pitch(db=db,pitch_data=pitch)

@router.get("/pitches", response_model=list[PitchResponse])
def get_all_pitches_endpoint(search: str = None, limit: int = 20):
    return get_all_pitches(search, limit)


@router.put("/pitches/{pitch_id}", response_model=PitchResponse)
def update_pitch_endpoint(pitch_id: int, pitch: PitchCreate):
    return update_pitch(pitch_id, pitch)

@router.get("/pitches/{pitch_id}", response_model=PitchResponse)
def get_pitch_by_id(pitch_id: int):
    return get_one_pitch(pitch_id)

@router.delete("/pitches/{pitch_id}", response_model=PitchResponse)
def delete_pitch_endpoint(pitch_id: int):
    return delete_pitch(pitch_id)
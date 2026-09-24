from fastapi import APIRouter
from .schemas import PitchCreate, PitchResponse
from .service import create_pitch, get_all_pitches, delete_pitch, update_pitch
router = APIRouter()

@router.post("/pitches", response_model=PitchResponse)
def create_pitch_endpoint(pitch: PitchCreate):
    return create_pitch(pitch)


@router.get("/pitches", response_model=list[PitchResponse])
def get_all_pitches_endpoint(search: str = None, limit: int = 20):
    return get_all_pitches(search, limit)


@router.put("/pitches/{pitch_id}", response_model=PitchResponse)
def update_pitch_endpoint(pitch_id: int, pitch: PitchCreate):
    return update_pitch(pitch_id, pitch)

# @router.get("/pitches/{pitch_id}", response_model=PitchResponse)
# def get_pitch_by_id(pitch_id: int):
#     return PitchResponse(pitch_id,pitch)

@router.delete("/pitches/{pitch_id}", response_model=PitchResponse)
def delete_pitch_endpoint(pitch_id: int):
    return delete_pitch(pitch_id)
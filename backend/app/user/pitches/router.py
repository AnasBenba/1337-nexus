import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCreate, PitchResponse
from app.user.pitches.service import (
    create_pitch,
    delete_pitch,
    get_one_pitch,
    update_pitch,
)

router = APIRouter(prefix="/api/v1/user/pitches", tags=["Pitches"])


@router.post(
    "",
    response_model=PitchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project pitch",
)
async def create_pitch_endpoint(
    pitch: PitchCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_authenticated_user)],
) -> Pitch:
    return await create_pitch(db=db, pitch=pitch, author_id=current_user.id)


@router.get(
    "",
    response_model=list[PitchResponse],
    summary="List all project pitches",
)
async def list_pitches_endpoint(
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[Pitch]:
    result = await db.execute(select(Pitch).order_by(Pitch.created_at.desc()))
    return list(result.scalars().all())


@router.get(
    "/{pitch_id}",
    response_model=PitchResponse,
    summary="Get details of a specific pitch",
)
async def get_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Pitch:
    return await get_one_pitch(db=db, pitch_id=pitch_id)


async def require_pitch_author(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    current_user: Users,
) -> Pitch:
    pitch = await get_one_pitch(db=db, pitch_id=pitch_id)
    if pitch.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify your own pitches",
        )
    return pitch


@router.put(
    "/{pitch_id}",
    response_model=PitchResponse,
    summary="Update a pitch you created",
)
async def update_pitch_endpoint(
    pitch_id: uuid.UUID,
    pitch_data: PitchCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_authenticated_user)],
) -> Pitch:
    await require_pitch_author(db, pitch_id, current_user)
    return await update_pitch(db=db, pitch_id=pitch_id, pitch=pitch_data)


@router.delete(
    "/{pitch_id}",
    response_model=dict[str, str],
    summary="Delete a pitch you created",
)
async def delete_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_authenticated_user)],
) -> dict[str, str]:
    await require_pitch_author(db, pitch_id, current_user)
    return await delete_pitch(db=db, pitch_id=pitch_id)

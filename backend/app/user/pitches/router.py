from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCategory, PitchCreate, PitchResponse
from app.user.pitches.service import (
    create_pitch,
    delete_pitch,
    get_one_pitch,
    search_pitches,
    update_pitch,
)

router = APIRouter(tags=["Pitches"])


async def require_pitch_author(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    current_user: Users,
) -> Pitch:
    """Ensure current user is the pitch author or an administrator."""
    pitch = await get_one_pitch(db=db, pitch_id=pitch_id)
    is_admin = getattr(current_user, "role", "") == "admin"
    if not is_admin and pitch.author_id and pitch.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify your own pitches",
        )
    return pitch


@router.get(
    "/api/v1/user/pitches/search",
    response_model=list[PitchResponse],
    summary="Search project pitches by semantic similarity",
)
@router.get(
    "/api/v1/pitches/search",
    response_model=list[PitchResponse],
    include_in_schema=False,
)
@router.get(
    "/api/v1/search",
    response_model=list[PitchResponse],
    include_in_schema=False,
)
async def search_pitches_endpoint(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    query: str = Query(...),
    limit: int = Query(default=10, le=50),
    category: PitchCategory | None = None,
) -> list[Pitch]:
    results = await search_pitches(db=db, query=query, limit=limit, category=category)
    return list(results)


@router.post(
    "/api/v1/user/pitches",
    response_model=PitchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project pitch",
)
@router.post(
    "/api/v1/pitches",
    response_model=PitchResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_pitch_endpoint(
    pitch: PitchCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user)],
) -> Pitch:
    return await create_pitch(db=db, pitch=pitch, author_id=current_user.id)


@router.get(
    "/api/v1/user/pitches",
    response_model=list[PitchResponse],
    summary="List all project pitches",
)
@router.get(
    "/api/v1/pitches",
    response_model=list[PitchResponse],
    include_in_schema=False,
)
async def list_pitches_endpoint(
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[Pitch]:
    result = await db.execute(select(Pitch).order_by(Pitch.created_at.desc()).limit(40))
    return list(result.scalars().all())


@router.get(
    "/api/v1/user/pitches/{pitch_id}",
    response_model=PitchResponse,
    summary="Get details of a specific pitch",
)
@router.get(
    "/api/v1/pitches/{pitch_id}",
    response_model=PitchResponse,
    include_in_schema=False,
)
async def get_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Pitch:
    return await get_one_pitch(db=db, pitch_id=pitch_id)


@router.put(
    "/api/v1/user/pitches/{pitch_id}",
    response_model=PitchResponse,
    summary="Update details of a specific pitch",
)
@router.put(
    "/api/v1/pitches/{pitch_id}",
    response_model=PitchResponse,
    include_in_schema=False,
)
async def update_pitch_endpoint(
    pitch_id: uuid.UUID,
    pitch: PitchCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user)],
) -> Pitch:
    await require_pitch_author(db, pitch_id, current_user)
    return await update_pitch(db=db, pitch_id=pitch_id, pitch=pitch)


@router.delete(
    "/api/v1/user/pitches/{pitch_id}",
    summary="Delete a pitch",
)
@router.delete(
    "/api/v1/pitches/{pitch_id}",
    include_in_schema=False,
)
async def delete_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user)],
) -> dict[str, str]:
    await require_pitch_author(db, pitch_id, current_user)
    return await delete_pitch(db=db, pitch_id=pitch_id)

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_optional_user
from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import (
    PitchCategory,
    PitchCreate,
    PitchResponse,
    PitchVoteRequest,
    PitchVoteResponse,
    VoteDirection,
)
from app.user.pitches.service import (
    create_pitch,
    delete_pitch,
    enrich_pitches_with_votes,
    get_one_pitch,
    get_pitch_votes,
    publish_pitch,
    remove_user_vote,
    search_pitches,
    update_pitch,
    user_vote_on_pitch,
)

router = APIRouter(tags=["Pitches"])


async def require_pitch_author(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    current_user: Users,
) -> Pitch:
    """Ensure current user is the pitch author or an administrator."""
    pitch = await get_one_pitch(db=db, pitch_id=pitch_id)
    is_admin = getattr(current_user, "role", "") in ("admin", "superadmin")
    if not is_admin and pitch.author_id != current_user.id:
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
    current_user: Annotated[Users | None, Depends(get_optional_user)],
    query: str = Query(...),
    limit: int = Query(default=10, le=50),
    category: PitchCategory | None = None,
) -> list[PitchResponse]:
    results = await search_pitches(db=db, query=query, limit=limit, category=category)
    user_id = current_user.id if current_user else None
    return await enrich_pitches_with_votes(db=db, pitches=results, user_id=user_id)


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
    current_user: Annotated[Users | None, Depends(get_optional_user)],
) -> list[PitchResponse]:
    result = await db.execute(select(Pitch).order_by(Pitch.created_at.desc()).limit(60))
    pitches = list(result.scalars().all())
    user_id = current_user.id if current_user else None
    return await enrich_pitches_with_votes(db=db, pitches=pitches, user_id=user_id)


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
    current_user: Annotated[Users | None, Depends(get_optional_user)],
) -> PitchResponse:
    pitch = await get_one_pitch(db=db, pitch_id=pitch_id)
    user_id = current_user.id if current_user else None
    enriched = await enrich_pitches_with_votes(db=db, pitches=[pitch], user_id=user_id)
    return enriched[0]


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


@router.post(
    "/api/v1/user/pitches/{pitch_id}/publish",
    response_model=PitchResponse,
    summary="Publish a pitch",
)
@router.post(
    "/api/v1/pitches/{pitch_id}/publish",
    response_model=PitchResponse,
    include_in_schema=False,
)
async def publish_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user)],
) -> Pitch:
    await require_pitch_author(db, pitch_id, current_user)
    return await publish_pitch(db=db, pitch_id=pitch_id)


@router.get(
    "/api/v1/user/pitches/{pitch_id}/votes",
    response_model=PitchVoteResponse,
    summary="Get pitch vote totals",
)
@router.get(
    "/api/v1/pitches/{pitch_id}/votes",
    response_model=PitchVoteResponse,
    include_in_schema=False,
)
async def get_pitch_votes_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users | None, Depends(get_optional_user)],
) -> PitchVoteResponse:
    user_id = current_user.id if current_user else None
    return await get_pitch_votes(db=db, pitch_id=pitch_id, user_id=user_id)


@router.post(
    "/api/v1/user/pitches/{pitch_id}/vote",
    response_model=PitchVoteResponse,
    summary="Cast or change your vote on a pitch",
)
@router.post(
    "/api/v1/pitches/{pitch_id}/vote",
    response_model=PitchVoteResponse,
    include_in_schema=False,
)
async def vote_on_pitch_endpoint(
    pitch_id: uuid.UUID,
    vote: PitchVoteRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user)],
) -> PitchVoteResponse:
    return await user_vote_on_pitch(
        db=db,
        pitch_id=pitch_id,
        user_id=current_user.id,
        is_upvote=vote.direction == VoteDirection.UP,
    )


@router.delete(
    "/api/v1/user/pitches/{pitch_id}/vote",
    response_model=PitchVoteResponse,
    summary="Remove your vote from a pitch",
)
@router.delete(
    "/api/v1/pitches/{pitch_id}/vote",
    response_model=PitchVoteResponse,
    include_in_schema=False,
)
async def remove_pitch_vote_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user)],
) -> PitchVoteResponse:
    return await remove_user_vote(
        db=db,
        pitch_id=pitch_id,
        user_id=current_user.id,
    )


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

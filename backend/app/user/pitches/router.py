import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
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
    get_one_pitch,
    get_pitch_votes,
    remove_user_vote,
    search_pitches,
    update_pitch,
    user_vote_on_pitch,
)

router = APIRouter(prefix="/api/v1/user/pitches", tags=["Pitches"])


@router.get(
    "/search",
    response_model=list[PitchResponse],
    summary="Search project pitches by semantic similarity",
)
# @router.get(
#     "/api/v1/pitches/search",
#     response_model=list[PitchResponse],
#     include_in_schema=False,
# )
# @router.get(
#     "/api/v1/search",
#     response_model=list[PitchResponse],
#     include_in_schema=False,
# )
async def search_pitches_endpoint(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    query: str = Query(...),
    limit: int = Query(default=10, le=50),
    category: PitchCategory | None = None,
) -> list[Pitch]:
    results = await search_pitches(db=db, query=query, limit=limit, category=category)
    return list(results)


@router.post(
    "",
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
    current_user: Annotated[Users, Depends(get_authenticated_user)],
) -> Pitch:
    return await create_pitch(db=db, pitch=pitch, author_id=current_user.id)


@router.get(
    "",
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
    "/{pitch_id}",
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


@router.get(
    "/{pitch_id}/votes",
    response_model=PitchVoteResponse,
    summary="Get pitch vote totals",
)
async def get_pitch_votes_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> PitchVoteResponse:
    return await get_pitch_votes(db=db, pitch_id=pitch_id)


@router.post(
    "/{pitch_id}/vote",
    response_model=PitchVoteResponse,
    summary="Cast or change your vote on a pitch",
)
async def vote_on_pitch_endpoint(
    pitch_id: uuid.UUID,
    vote: PitchVoteRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_authenticated_user)],
) -> PitchVoteResponse:
    return await user_vote_on_pitch(
        db=db,
        pitch_id=pitch_id,
        user_id=current_user.id,
        is_upvote=vote.direction == VoteDirection.UP,
    )


@router.delete(
    "/{pitch_id}/vote",
    response_model=PitchVoteResponse,
    summary="Remove your vote from a pitch",
)
async def remove_pitch_vote_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_authenticated_user)],
) -> PitchVoteResponse:
    return await remove_user_vote(
        db=db,
        pitch_id=pitch_id,
        user_id=current_user.id,
    )


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

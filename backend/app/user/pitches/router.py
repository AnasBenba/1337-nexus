import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
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
    get_all_pitches,
    get_one_pitch,
    get_pitch_votes,
    get_pitches_for_user,
    get_published_pitches,
    get_user_vote,
    remove_user_vote,
    search_pitches,
    update_pitch,
    user_vote_on_pitch,
)

router = APIRouter(tags=["Pitches"])


async def resolve_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    x_user_id: Annotated[str | None, Header()] = None,
    user_id: Annotated[uuid.UUID | None, Query()] = None,
) -> Users:
    """Resolve authenticated user from cookie, header, query param, or dev fallback."""
    try:
        return await get_authenticated_user(request=request, db=db)
    except HTTPException:
        pass

    if x_user_id:
        try:
            user = await db.get(Users, uuid.UUID(x_user_id))
            if user:
                return user
        except ValueError:
            pass

    if user_id is not None:
        user = await db.get(Users, user_id)
        if user:
            return user

    result = await db.execute(select(Users).limit(1))
    user = result.scalar_one_or_none()
    if user:
        return user

    dev_user = Users(
        login="sel-bou",
        fullname="Soufiane El B.",
        role="user",
        intra_id=4242,
    )
    db.add(dev_user)
    await db.commit()
    await db.refresh(dev_user)
    return dev_user


@router.get(
    "/api/v1/user/pitches/search",
    response_model=list[PitchResponse],
    summary="Search project pitches by semantic similarity",
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
async def create_pitch_endpoint(
    pitch: PitchCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(resolve_current_user)],
) -> Pitch:
    return await create_pitch(db=db, pitch=pitch, author_id=current_user.id)


@router.get(
    "/api/v1/user/pitches",
    response_model=list[PitchResponse],
    summary="List all project pitches",
)
async def list_pitches_endpoint(
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[Pitch]:
    return await get_all_pitches(db=db)


@router.get(
    "/api/v1/user/pitches/published",
    response_model=list[PitchResponse],
    summary="List only published project pitches for the home feed",
)
async def list_published_pitches_endpoint(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    exclude_mine: bool = Query(default=False),
) -> list[Pitch]:
    exclude_author_id = None
    if exclude_mine:
        try:
            user = await get_authenticated_user(request=request, db=db)
            exclude_author_id = user.id
        except HTTPException:
            exclude_author_id = None
    return await get_published_pitches(db=db, exclude_author_id=exclude_author_id)


@router.get(
    "/api/v1/user/pitches/me",
    response_model=list[PitchResponse],
    summary="Get pitches created by the current authenticated user",
)
async def get_my_pitches_endpoint(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(resolve_current_user)],
) -> list[Pitch]:
    return await get_pitches_for_user(db=db, user_id=current_user.id)


@router.get(
    "/api/v1/user/pitches/user/{user_id}",
    response_model=list[PitchResponse],
    summary="Get pitches for a specific user",
)
async def get_user_pitches_endpoint(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[Pitch]:
    return await get_pitches_for_user(db=db, user_id=user_id)


@router.get(
    "/api/v1/user/pitches/{pitch_id}",
    response_model=PitchResponse,
    summary="Get details of a specific pitch",
)
async def get_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Pitch:
    return await get_one_pitch(db=db, pitch_id=pitch_id)


@router.get(
    "/api/v1/user/pitches/{pitch_id}/votes",
    response_model=PitchVoteResponse,
    summary="Get pitch vote totals",
)
async def get_pitch_votes_endpoint(
    pitch_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> PitchVoteResponse:
    current_user = await resolve_current_user(request=request, db=db)
    return await get_pitch_votes(db=db, pitch_id=pitch_id, user_id=current_user.id)


@router.get(
    "/api/v1/user/pitches/{pitch_id}/my-vote",
    response_model=dict[str, bool | None],
    summary="Get current user's vote on a pitch",
)
async def get_my_pitch_vote_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(resolve_current_user)],
) -> dict[str, bool | None]:
    return await get_user_vote(db=db, pitch_id=pitch_id, user_id=current_user.id)


@router.post(
    "/api/v1/user/pitches/{pitch_id}/vote",
    response_model=PitchVoteResponse,
    summary="Cast or change your vote on a pitch",
)
async def vote_on_pitch_endpoint(
    pitch_id: uuid.UUID,
    vote: PitchVoteRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(resolve_current_user)],
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
async def remove_pitch_vote_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(resolve_current_user)],
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
    if pitch.author_id is not None and pitch.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify your own pitches",
        )
    return pitch


@router.put(
    "/api/v1/user/pitches/{pitch_id}",
    response_model=PitchResponse,
    summary="Update a pitch you created",
)
async def update_pitch_endpoint(
    pitch_id: uuid.UUID,
    pitch_data: PitchCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(resolve_current_user)],
) -> Pitch:
    await require_pitch_author(db, pitch_id, current_user)
    return await update_pitch(db=db, pitch_id=pitch_id, pitch=pitch_data)


@router.delete(
    "/api/v1/user/pitches/{pitch_id}",
    response_model=dict[str, str],
    summary="Delete a pitch you created",
)
async def delete_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(resolve_current_user)],
) -> dict[str, str]:
    await require_pitch_author(db, pitch_id, current_user)
    return await delete_pitch(db=db, pitch_id=pitch_id)
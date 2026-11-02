import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCreate, PitchResponse
from app.user.pitches.service import create_pitch, get_one_pitch

router = APIRouter(prefix="/api/v1/user/pitches", tags=["pitches"])


async def get_current_user_dep(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    x_user_id: Annotated[str | None, Header()] = None,
    user_id: Annotated[int | None, Query()] = None,
) -> Users | None:
    if x_user_id:
        try:
            return await db.get(Users, int(x_user_id))
        except ValueError:
            pass
    if user_id:
        return await db.get(Users, user_id)
    result = await db.execute(select(Users).limit(1))
    return result.scalar_one_or_none()


@router.post(
    "",
    response_model=PitchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project pitch",
)
async def create_pitch_endpoint(
    pitch: PitchCreate,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users | None, Depends(get_current_user_dep)] = None,
) -> Pitch:
    author_id = current_user.id if current_user else 1
    return await create_pitch(db=db, pitch=pitch, author_id=author_id)


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

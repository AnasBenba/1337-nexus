from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.projects.refine_project.schemas import (
    ApplySuggestionRequest,
    ApplySuggestionResponse,
    DismissSuggestionResponse,
    RefineResponse,
    RefineStatusResponse,
)
from app.user.projects.refine_project.service import (
    apply_pitch_suggestion,
    dismiss_pitch_suggestion,
    get_pitch_refine_status,
    request_pitch_refinement,
)

router = APIRouter(prefix="/api/v1/user/projects", tags=["pitch-refine"])


async def get_current_user_dep(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    x_user_id: Annotated[str | None, Header()] = None,
    user_id: Annotated[int | None, Query()] = None,
) -> Users:
    """
    Resolve the current authenticated user.
    Supports X-User-Id header, query param, or fallback to database user.
    """
    # 1. Explicit Header
    if x_user_id:
        try:
            uid = int(x_user_id)
            user = await db.get(Users, uid)
            if user:
                return user
        except ValueError:
            pass

    # 2. Query parameter
    if user_id:
        user = await db.get(Users, user_id)
        if user:
            return user

    # 3. Fallback to existing user in database
    result = await db.execute(select(Users).limit(1))
    user = result.scalar_one_or_none()
    if user:
        return user

    # 4. Dev seed user if database is empty
    dev_user = Users(
        id=1,
        login="sel-bou",
        fullname="Soufiane El B.",
        role="user",
        intra_id=4242,
    )
    db.add(dev_user)
    await db.commit()
    await db.refresh(dev_user)
    return dev_user


@router.post(
    "/{pitch_id}/refine",
    response_model=RefineResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request asynchronous AI critique for a pitch",
)
async def refine_pitch_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user_dep)],
) -> RefineResponse:
    return await request_pitch_refinement(
        db=db,
        pitch_id=pitch_id,
        current_user=current_user,
    )


@router.get(
    "/{pitch_id}/refine/status",
    response_model=RefineStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get status and suggestions of the pitch critique",
)
async def get_refine_status_endpoint(
    pitch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user_dep)],
) -> RefineStatusResponse:
    return await get_pitch_refine_status(
        db=db,
        pitch_id=pitch_id,
        current_user=current_user,
    )


@router.post(
    "/{pitch_id}/refine/suggestions/{suggestion_id}/apply",
    response_model=ApplySuggestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Version-guarded apply of an AI suggestion to the pitch",
)
async def apply_suggestion_endpoint(
    pitch_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    request: ApplySuggestionRequest,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user_dep)],
) -> ApplySuggestionResponse:
    return await apply_pitch_suggestion(
        db=db,
        pitch_id=pitch_id,
        suggestion_id=suggestion_id,
        version_token=request.version_token,
        current_user=current_user,
    )


@router.post(
    "/{pitch_id}/refine/suggestions/{suggestion_id}/dismiss",
    response_model=DismissSuggestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Dismiss an AI suggestion",
)
async def dismiss_suggestion_endpoint(
    pitch_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_current_user_dep)],
) -> DismissSuggestionResponse:
    return await dismiss_pitch_suggestion(
        db=db,
        pitch_id=pitch_id,
        suggestion_id=suggestion_id,
        current_user=current_user,
    )

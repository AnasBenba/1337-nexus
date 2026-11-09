import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
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

router = APIRouter(tags=["pitch-refine"])


async def get_current_user_dep(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    x_user_id: Annotated[str | None, Header()] = None,
    user_id: Annotated[str | None, Query()] = None,
) -> Users:
    """Resolve current user via X-User-Id header, query param, or standard auth cookie/bearer."""
    if x_user_id:
        try:
            uid = uuid.UUID(x_user_id) if not isinstance(x_user_id, uuid.UUID) else x_user_id
            user = await db.get(Users, uid)
            if user:
                return user
        except (ValueError, TypeError):
            pass

    if user_id:
        try:
            uid = uuid.UUID(user_id) if not isinstance(user_id, uuid.UUID) else user_id
            user = await db.get(Users, uid)
            if user:
                return user
        except (ValueError, TypeError):
            pass

    return await get_current_user(request, db)


# Supports both canonical /api/v1/user/projects and frontend flow /api/user/projects/refine-project
@router.post(
    "/api/v1/user/projects/{pitch_id}/refine",
    response_model=RefineResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request asynchronous AI critique for a pitch",
)
@router.post(
    "/api/user/projects/refine-project/{pitch_id}/refine",
    response_model=RefineResponse,
    status_code=status.HTTP_202_ACCEPTED,
    include_in_schema=False,
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
    "/api/v1/user/projects/{pitch_id}/refine/status",
    response_model=RefineStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get status and suggestions of the pitch critique",
)
@router.get(
    "/api/user/projects/refine-project/{pitch_id}/status",
    response_model=RefineStatusResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
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
    "/api/v1/user/projects/{pitch_id}/refine/suggestions/{suggestion_id}/apply",
    response_model=ApplySuggestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Version-guarded apply of an AI suggestion to the pitch",
)
@router.post(
    "/api/user/projects/refine-project/{pitch_id}/suggestions/{suggestion_id}/apply",
    response_model=ApplySuggestionResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
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
    "/api/v1/user/projects/{pitch_id}/refine/suggestions/{suggestion_id}/dismiss",
    response_model=DismissSuggestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Dismiss an AI suggestion",
)
@router.post(
    "/api/user/projects/refine-project/{pitch_id}/suggestions/{suggestion_id}/dismiss",
    response_model=DismissSuggestionResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
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

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.dependencies import get_current_user
from .schemas import ProfileUpdateRequest, UserProfileResponse, UserSummaryResponse
from .service import get_profile_by_id, get_profile_me, search_users, update_profile_me

router = APIRouter(tags=["Profile"])


@router.get("/api/v1/profile/me", response_model=UserProfileResponse)
@router.get("/profile/me", response_model=UserProfileResponse)
async def view_my_profile(
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> UserProfileResponse:
    """Get the current authenticated user's profile and interaction stats."""
    return await get_profile_me(db, current_user)


@router.patch("/api/v1/profile/me", response_model=UserProfileResponse)
@router.patch("/profile/me", response_model=UserProfileResponse)
async def edit_my_profile(
    update_data: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> UserProfileResponse:
    """Update profile information (bio, avatar, campus, fullname)."""
    return await update_profile_me(db, current_user, update_data)


@router.get("/api/v1/profile/{user_id}", response_model=UserProfileResponse)
@router.get("/profile/{user_id}", response_model=UserProfileResponse)
async def view_user_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> UserProfileResponse:
    """View another student's profile, including their stats and friendship status."""
    try:
        return await get_profile_by_id(db, user_id, current_user)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        ) from err


@router.get("/api/v1/users", response_model=list[UserSummaryResponse])
@router.get("/users", response_model=list[UserSummaryResponse])
async def list_campus_users(
    q: str | None = Query(default=None, description="Search query by login or full name"),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[UserSummaryResponse]:
    """Search and discover fellow 1337 students across campus."""
    return await search_users(db, current_user, query=q, limit=limit, offset=offset)

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.dependencies import get_current_user
from .schemas import AddFriendResponse, FriendUserResponse, FriendshipStatusResponse
from .service import add_friend, get_friendship_status, list_friends, remove_friend

router = APIRouter(tags=["Friends"])


@router.get("/api/v1/friends", response_model=list[FriendUserResponse])
@router.get("/friends", response_model=list[FriendUserResponse])
async def get_my_friends(
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[FriendUserResponse]:
    """Retrieve the list of friends for the authenticated user."""
    return await list_friends(db, current_user.id)


@router.post("/api/v1/friends/{friend_id}", response_model=AddFriendResponse)
@router.post("/friends/{friend_id}", response_model=AddFriendResponse)
async def add_new_friend(
    friend_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> AddFriendResponse:
    """Add a user as a friend."""
    try:
        friendship, friend = await add_friend(db, current_user.id, friend_id)
        friend_dto = FriendUserResponse(
            id=friend.id,
            login=friend.login,
            fullname=friend.fullname,
            avatar_url=friend.avatar_url,
            campus=friend.campus,
            bio=friend.bio,
            role=friend.role,
            is_online=True,
            friended_at=friendship.created_at,
        )
        return AddFriendResponse(
            status="ok",
            message=f"Added {friend.login} to friends",
            friendship_id=friendship.id,
            friend=friend_dto,
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err


@router.delete("/api/v1/friends/{friend_id}")
@router.delete("/friends/{friend_id}")
async def remove_existing_friend(
    friend_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> dict[str, str]:
    """Remove a user from friends."""
    try:
        await remove_friend(db, current_user.id, friend_id)
        return {"status": "ok", "message": "Friend removed successfully"}
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        ) from err


@router.get("/api/v1/friends/{target_id}/status", response_model=FriendshipStatusResponse)
@router.get("/friends/{target_id}/status", response_model=FriendshipStatusResponse)
async def check_friend_status(
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> FriendshipStatusResponse:
    """Check whether the current user is friends with target user."""
    return await get_friendship_status(db, current_user.id, target_id)

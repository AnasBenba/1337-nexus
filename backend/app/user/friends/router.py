from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import CurrentUser
from app.oauth.permissions import Permission, require
from app.oauth.user import Users
from app.user.friends import presence
from app.user.friends import service
from app.user.friends.schemas import FriendsOverview, FriendshipStatus

router = APIRouter(prefix="/api/v1/friends", tags=["friends"])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]
# Changing friendships needs this permission (see app/oauth/permissions.py).
CanManageFriends = Annotated[Users, Depends(require(Permission.MANAGE_FRIENDS))]


async def _user_or_404(session: AsyncSession, login: str) -> Users:
    result = await session.execute(select(Users).where(Users.login == login))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.get("", response_model=FriendsOverview, summary="My friends and pending requests")
async def list_friends(me: CurrentUser, session: DbSession) -> FriendsOverview:
    return await service.overview(session, me)


@router.get("/{login}", response_model=FriendshipStatus, summary="My friendship status with a user")
async def friendship_status(login: str, me: CurrentUser, session: DbSession) -> FriendshipStatus:
    other = await _user_or_404(session, login)
    friend_status = await service.get_status(session, me, other)
    online = friend_status == "friends" and presence.is_online(other.id)
    return FriendshipStatus(status=friend_status, online=online)


@router.post("/{login}", response_model=FriendshipStatus, summary="Send or accept a friend request")
async def add_friend(login: str, me: CanManageFriends, session: DbSession) -> FriendshipStatus:
    other = await _user_or_404(session, login)
    try:
        return FriendshipStatus(status=await service.add_friend(session, me, other))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.delete("/{login}", response_model=FriendshipStatus, summary="Unfriend, cancel or decline")
async def remove_friend(login: str, me: CanManageFriends, session: DbSession) -> FriendshipStatus:
    other = await _user_or_404(session, login)
    return FriendshipStatus(status=await service.remove_friend(session, me, other))

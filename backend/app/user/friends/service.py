from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.oauth.user import Users
from .models import Friendship
from .schemas import FriendUserResponse, FriendshipStatusResponse


async def list_friends(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[FriendUserResponse]:
    stmt = (
        select(Friendship)
        .where(
            or_(
                Friendship.user_id == user_id,
                Friendship.friend_id == user_id,
            ),
            Friendship.status == "accepted",
        )
        .order_by(Friendship.created_at.desc())
    )
    result = await db.execute(stmt)
    friendships = result.scalars().all()

    if not friendships:
        return []

    # Collect partner user IDs
    friend_mapping: dict[uuid.UUID, Friendship] = {}
    for f in friendships:
        other_id = f.friend_id if f.user_id == user_id else f.user_id
        if other_id not in friend_mapping:
            friend_mapping[other_id] = f

    # Fetch users
    users_stmt = select(Users).where(Users.id.in_(list(friend_mapping.keys())))
    users_result = await db.execute(users_stmt)
    user_records = users_result.scalars().all()

    friends_list: list[FriendUserResponse] = []
    for u in user_records:
        f = friend_mapping.get(u.id)
        friends_list.append(
            FriendUserResponse(
                id=u.id,
                login=u.login,
                fullname=u.fullname,
                avatar_url=u.avatar_url,
                campus=u.campus,
                bio=u.bio,
                role=u.role,
                is_online=True,  # Mock/live online status
                friended_at=f.created_at if f else None,
            )
        )

    # Sort alphabetically by login
    friends_list.sort(key=lambda item: item.login.lower())
    return friends_list


async def add_friend(
    db: AsyncSession,
    user_id: uuid.UUID,
    friend_id: uuid.UUID,
) -> tuple[Friendship, Users]:
    if user_id == friend_id:
        raise ValueError("Cannot add yourself as a friend")

    friend_user = await db.get(Users, friend_id)
    if friend_user is None:
        raise ValueError("User not found")

    # Check existing friendship in either direction
    stmt = select(Friendship).where(
        or_(
            (Friendship.user_id == user_id) & (Friendship.friend_id == friend_id),
            (Friendship.user_id == friend_id) & (Friendship.friend_id == user_id),
        )
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        return existing, friend_user

    friendship = Friendship(
        user_id=user_id,
        friend_id=friend_id,
        status="accepted",
    )
    db.add(friendship)
    await db.commit()
    await db.refresh(friendship)
    return friendship, friend_user


async def remove_friend(
    db: AsyncSession,
    user_id: uuid.UUID,
    friend_id: uuid.UUID,
) -> bool:
    stmt = select(Friendship).where(
        or_(
            (Friendship.user_id == user_id) & (Friendship.friend_id == friend_id),
            (Friendship.user_id == friend_id) & (Friendship.friend_id == user_id),
        )
    )
    friendship = (await db.execute(stmt)).scalar_one_or_none()
    if friendship is None:
        raise ValueError("Friendship not found")

    await db.delete(friendship)
    await db.commit()
    return True


async def get_friendship_status(
    db: AsyncSession,
    user_id: uuid.UUID,
    target_id: uuid.UUID,
) -> FriendshipStatusResponse:
    if user_id == target_id:
        return FriendshipStatusResponse(target_id=target_id, is_friend=False, friendship_id=None)

    stmt = select(Friendship).where(
        or_(
            (Friendship.user_id == user_id) & (Friendship.friend_id == target_id),
            (Friendship.user_id == target_id) & (Friendship.friend_id == user_id),
        )
    )
    friendship = (await db.execute(stmt)).scalar_one_or_none()
    return FriendshipStatusResponse(
        target_id=target_id,
        is_friend=friendship is not None,
        friendship_id=friendship.id if friendship else None,
    )

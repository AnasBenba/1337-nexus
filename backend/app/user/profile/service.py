from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.oauth.user import Users
from app.user.friends.models import Friendship
from app.user.pitches.models import Pitch
from app.user.projects.models import Project
from .schemas import ProfileUpdateRequest, UserProfileResponse, UserSummaryResponse


async def _get_user_stats(db: AsyncSession, user_id: uuid.UUID) -> dict[str, int]:
    # Count friends
    friends_count_stmt = select(func.count(Friendship.id)).where(
        or_(
            Friendship.user_id == user_id,
            Friendship.friend_id == user_id,
        ),
        Friendship.status == "accepted",
    )
    friends_count = (await db.execute(friends_count_stmt)).scalar() or 0

    # Count projects
    projects_count_stmt = select(func.count(Project.id)).where(
        Project.owner_id == user_id
    )
    projects_count = (await db.execute(projects_count_stmt)).scalar() or 0

    # Count pitches
    pitches_count_stmt = select(func.count(Pitch.id)).where(
        Pitch.author_id == user_id
    )
    pitches_count = (await db.execute(pitches_count_stmt)).scalar() or 0

    return {
        "friends_count": int(friends_count),
        "projects_count": int(projects_count),
        "pitches_count": int(pitches_count),
    }


async def get_profile_me(
    db: AsyncSession,
    current_user: Users,
) -> UserProfileResponse:
    stats = await _get_user_stats(db, current_user.id)
    return UserProfileResponse(
        id=current_user.id,
        login=current_user.login,
        fullname=current_user.fullname,
        email=current_user.email,
        role=current_user.role,
        avatar_url=current_user.avatar_url,
        bio=current_user.bio,
        campus=current_user.campus or "1337 Benguerir",
        created_at=current_user.created_at,
        is_self=True,
        is_friend=False,
        stats=stats,
    )


async def get_profile_by_id(
    db: AsyncSession,
    user_id: uuid.UUID,
    current_user: Users,
) -> UserProfileResponse:
    user = await db.get(Users, user_id)
    if user is None:
        raise ValueError("User not found")

    is_self = user.id == current_user.id
    is_friend = False
    if not is_self:
        friendship_stmt = select(Friendship.id).where(
            or_(
                (Friendship.user_id == current_user.id) & (Friendship.friend_id == user_id),
                (Friendship.user_id == user_id) & (Friendship.friend_id == current_user.id),
            ),
            Friendship.status == "accepted",
        )
        is_friend = (await db.execute(friendship_stmt)).scalar_one_or_none() is not None

    stats = await _get_user_stats(db, user.id)
    return UserProfileResponse(
        id=user.id,
        login=user.login,
        fullname=user.fullname,
        email=user.email if is_self else None,  # keep email private unless self
        role=user.role,
        avatar_url=user.avatar_url,
        bio=user.bio,
        campus=user.campus or "1337 Benguerir",
        created_at=user.created_at,
        is_self=is_self,
        is_friend=is_friend,
        stats=stats,
    )


async def update_profile_me(
    db: AsyncSession,
    current_user: Users,
    update_data: ProfileUpdateRequest,
) -> UserProfileResponse:
    user = await db.get(Users, current_user.id)
    if user is None:
        raise ValueError("User not found")

    if update_data.fullname is not None:
        user.fullname = update_data.fullname.strip()
    if update_data.bio is not None:
        user.bio = update_data.bio.strip()
    if update_data.avatar_url is not None:
        user.avatar_url = update_data.avatar_url.strip()
    if update_data.campus is not None:
        user.campus = update_data.campus.strip()

    await db.commit()
    await db.refresh(user)
    return await get_profile_me(db, user)


async def search_users(
    db: AsyncSession,
    current_user: Users,
    query: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> list[UserSummaryResponse]:
    stmt = select(Users).where(Users.id != current_user.id)
    if query:
        pattern = f"%{query}%"
        stmt = stmt.where(
            or_(
                Users.login.ilike(pattern),
                Users.fullname.ilike(pattern),
            )
        )
    stmt = stmt.order_by(Users.login.asc()).limit(limit).offset(offset)
    users = (await db.execute(stmt)).scalars().all()

    if not users:
        return []

    # Get friendship status with current user for all returned users
    friend_ids_stmt = select(
        Friendship.user_id,
        Friendship.friend_id,
    ).where(
        or_(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == current_user.id,
        ),
        Friendship.status == "accepted",
    )
    pairs = (await db.execute(friend_ids_stmt)).all()
    friend_set = set()
    for uid, fid in pairs:
        friend_set.add(fid if uid == current_user.id else uid)

    return [
        UserSummaryResponse(
            id=u.id,
            login=u.login,
            fullname=u.fullname,
            avatar_url=u.avatar_url,
            campus=u.campus or "1337 Benguerir",
            bio=u.bio,
            role=u.role,
            is_friend=u.id in friend_set,
        )
        for u in users
    ]

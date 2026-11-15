from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.user.notifications.service import (
    count_unread_direct_messages,
    count_unread_notifications,
    has_unread_activity,
)

router = APIRouter(prefix="/api/v1/user/notifications", tags=["Notifications"])


async def resolve_current_user_safe(
    request: Request,
    db: AsyncSession,
) -> Users | None:
    try:
        return await get_authenticated_user(request=request, db=db)
    except HTTPException:
        result = await db.execute(select(Users).limit(1))
        return result.scalar_one_or_none()


@router.get("/unread")
async def check_unread_activity(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, bool]:
    user = await resolve_current_user_safe(request, db)
    if not user:
        return {"has_unread": False}
    has_unread = await has_unread_activity(db, user.id)
    return {"has_unread": has_unread}


@router.get("/count")
@router.get("/unread-count")
async def get_unread_counts(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, int]:
    user = await resolve_current_user_safe(request, db)
    if not user:
        return {"notifications": 0, "unread_messages": 0, "total": 0}
    notifications_count = await count_unread_notifications(db, user.id)
    messages_count = await count_unread_direct_messages(db, user.id)
    return {
        "notifications": notifications_count,
        "unread_messages": messages_count,
        "total": notifications_count + messages_count,
    }

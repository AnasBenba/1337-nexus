from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.user.notifications.service import has_unread_activity

router = APIRouter(prefix="/api/v1/user/notifications", tags=["Notifications"])


@router.get("/unread")
async def check_unread_activity(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    current_user: Annotated[Users, Depends(get_authenticated_user)],
) -> dict[str, bool]:
    has_unread = await has_unread_activity(db, current_user.id)
    return {"has_unread": has_unread}
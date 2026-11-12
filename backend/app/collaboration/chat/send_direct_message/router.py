from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.teams.models import WorkspaceTeamMember

router = APIRouter()


@router.get("/messages/team/{team_id}")
async def get_team_chat_history(
    team_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_authenticated_user),
) -> list[dict[str, str | None]]:
    membership = await db.get(
        WorkspaceTeamMember,
        (team_id, current_user.id),
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team",
        )

    statement = (
        select(Message)
        .where(
            Message.team_id == team_id,
            Message.receiver_id.is_(None),
        )
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(statement)
    return [
        {
            "id": str(message.id),
            "team_id": str(message.team_id),
            "sender_id": str(message.sender_id),
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message in result.scalars().all()
    ]


@router.get("/messages/{user_a}/{user_b}")
async def get_chat_history(
    user_a: UUID,
    user_b: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_authenticated_user),
) -> list[dict[str, str | None]]:
    if current_user.id not in {user_a, user_b}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own conversations",
        )
    stmt = (
        select(Message)
        .where(
            ((Message.sender_id == user_a) & (Message.receiver_id == user_b))
            | ((Message.sender_id == user_b) & (Message.receiver_id == user_a))
        )
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [
        {
            "id": str(message.id),
            "content": message.content,
            "created_at": message.created_at.isoformat(),
            "sender_id": str(message.sender_id),
            "receiver_id": str(message.receiver_id),
        }
        for message in messages
    ]

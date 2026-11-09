from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.jwt import verify_access_token
from app.oauth.user import Users, get_user_by_intra_id
from .service import start_chat

router = APIRouter()


async def get_authenticated_websocket_user(
    websocket: WebSocket,
    db: AsyncSession,
) -> Users | None:
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=1008, reason="Not authenticated")
        return None

    try:
        claims = verify_access_token(token)
        intra_id = int(claims["sub"])
    except (HTTPException, KeyError, TypeError, ValueError):
        await websocket.close(code=1008, reason="Invalid access token")
        return None

    user = await get_user_by_intra_id(db, intra_id)
    if user is None:
        await websocket.close(code=1008, reason="User not found")
        return None

    return user


@router.websocket("/ws/chat/{user_id}")
async def chat_endpoint(
    websocket: WebSocket,
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    current_user = await get_authenticated_websocket_user(websocket, db)
    if current_user is None:
        return
    if current_user.id != user_id:
        await websocket.close(code=1008, reason="User ID does not match authenticated account")
        return

    await start_chat(websocket, user_id, db)


@router.websocket("/ws/chat/team/{team_id}/{user_id}")
async def team_chat_endpoint(
    websocket: WebSocket,
    team_id: int,
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    current_user = await get_authenticated_websocket_user(websocket, db)
    if current_user is None:
        return
    if current_user.id != user_id:
        await websocket.close(code=1008, reason="User ID does not match authenticated account")
        return

    await websocket.close(
        code=1008,
        reason="Team chat is unavailable until membership checks are implemented",
    )


@router.get("/messages/team/{team_id}")
async def get_team_chat_history(
    team_id: int,
    current_user: Users = Depends(get_authenticated_user),
) -> list[dict[str, str | None]]:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Team chat history is unavailable until team membership checks are implemented",
    )


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
            ((Message.sender_id == user_a) & (Message.receiver_id == user_b)) |
            ((Message.sender_id == user_b) & (Message.receiver_id == user_a))
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
import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.core.db import get_db_session
from app.oauth.user import Users

from .socket_manager import manager
from .service import start_chat

router = APIRouter()


@router.websocket("/ws/chat/{user_id}")
async def chat_endpoint(
    websocket: WebSocket,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    if await db.get(Users, user_id) is None:
        await websocket.close(code=1008, reason="Unknown user")
        return

    await start_chat(websocket, user_id, db)


@router.websocket("/ws/chat/team/{team_id}/{user_id}")
async def team_chat_endpoint(
    websocket: WebSocket,
    team_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    if await db.get(Users, user_id) is None:
        await websocket.close(code=1008, reason="Unknown user")
        return

    await manager.connect_team(team_id, user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                content = payload["content"]
            except (json.JSONDecodeError, KeyError, TypeError):
                await websocket.send_json({"error": "Message must contain content"})
                continue

            new_msg = Message(
                sender_id=user_id,
                team_id=team_id,
                content=content,
            )
            db.add(new_msg)
            await db.commit()

            broadcast_payload = json.dumps({
                "from": user_id,
                "team_id": team_id,
                "content": content
            })
            await manager.broadcast_to_team(team_id, user_id, broadcast_payload)

    except WebSocketDisconnect:
        manager.disconnect_team(team_id, user_id)


@router.get("/messages/team/{team_id}")
async def get_team_chat_history(
    team_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, str | None]]:
    stmt = (
        select(Message)
        .where(Message.team_id == team_id)
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
            "team_id": str(message.team_id),
        }
        for message in messages
    ]


@router.get("/messages/{user_a}/{user_b}")
async def get_chat_history(
    user_a: int,
    user_b: int,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, str | None]]:
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
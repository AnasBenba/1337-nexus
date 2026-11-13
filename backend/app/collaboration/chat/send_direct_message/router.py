import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.core.auth import get_current_user_strict
from app.core.db import get_db_session
from app.oauth.user import Users
from app.realtime.presence import presence_manager

from .service import start_chat
from .socket_manager import manager

router = APIRouter()


@router.websocket("/ws/chat/{user_id}")
async def chat_endpoint(
    websocket: WebSocket,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    if await db.get(Users, user_id) is None:
        await websocket.close(code=1008, reason="Unknown user")
        return

    await start_chat(websocket, user_id, db)


@router.websocket("/ws/chat/team/{team_id}/{user_id}")
async def team_chat_endpoint(
    websocket: WebSocket,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    user = await db.get(Users, user_id)
    if user is None:
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
            await db.refresh(new_msg)

            broadcast_payload = json.dumps(
                {
                    "id": str(new_msg.id),
                    "from": str(user_id),
                    "sender_id": str(user_id),
                    "sender_login": user.login,
                    "sender_fullname": user.fullname,
                    "team_id": str(team_id),
                    "content": content,
                    "created_at": new_msg.created_at.isoformat() if new_msg.created_at else None,
                }
            )
            await manager.broadcast_to_team(team_id, user_id, broadcast_payload)

    except WebSocketDisconnect:
        manager.disconnect_team(team_id, user_id)


@router.get("/messages/team/{team_id}")
@router.get("/api/v1/messages/team/{team_id}", include_in_schema=False)
async def get_team_chat_history(
    team_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, str | None]]:
    stmt = select(Message).where(Message.team_id == team_id).order_by(Message.created_at.asc())
    result = await db.execute(stmt)
    messages = list(result.scalars().all())
    if not messages:
        return []

    sender_ids = {m.sender_id for m in messages}
    users_res = await db.execute(select(Users).where(Users.id.in_(sender_ids)))
    users_by_id = {u.id: u for u in users_res.scalars().all()}

    return [
        {
            "id": str(message.id),
            "content": message.content,
            "created_at": message.created_at.isoformat() if message.created_at else None,
            "sender_id": str(message.sender_id),
            "sender_login": (
                users_by_id[message.sender_id].login
                if message.sender_id in users_by_id
                else f"user_{str(message.sender_id)[:6]}"
            ),
            "sender_fullname": (
                users_by_id[message.sender_id].fullname
                if message.sender_id in users_by_id
                else f"Teammate {str(message.sender_id)[:6]}"
            ),
            "team_id": str(message.team_id),
        }
        for message in messages
    ]


@router.get("/messages/peers")
@router.get("/api/v1/messages/peers", include_in_schema=False)
async def list_chat_peers(
    current_user: Users = Depends(get_current_user_strict),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    res = await db.execute(
        select(Users)
        .where(Users.is_active.is_(True))
        .order_by(Users.fullname.asc(), Users.login.asc())
        .limit(100)
    )
    users = res.scalars().all()
    online_ids = presence_manager.get_online_user_ids()
    return [
        {
            "id": str(u.id),
            "login": u.login,
            "fullname": u.fullname,
            "email": u.email,
            "avatar_url": u.avatar_url,
            "role": u.role,
            "is_self": u.id == current_user.id,
            "is_online": str(u.id) in online_ids,
        }
        for u in users
    ]


@router.get("/messages/{user_a}/{user_b}")
@router.get("/api/v1/messages/{user_a}/{user_b}", include_in_schema=False)
async def get_chat_history(
    user_a: uuid.UUID,
    user_b: uuid.UUID,
    current_user: Users = Depends(get_current_user_strict),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    if current_user.id not in (user_a, user_b):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own direct message history",
        )
    stmt = (
        select(Message)
        .where(
            Message.team_id.is_(None),
            (
                ((Message.sender_id == user_a) & (Message.receiver_id == user_b))
                | ((Message.sender_id == user_b) & (Message.receiver_id == user_a))
            ),
        )
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [
        {
            "id": str(message.id),
            "content": message.content,
            "created_at": message.created_at.isoformat() if message.created_at else None,
            "sender_id": str(message.sender_id),
            "receiver_id": str(message.receiver_id) if message.receiver_id else None,
            "is_read": bool(message.is_read),
            "delivered": getattr(message, "is_delivered", True),
        }
        for message in messages
    ]

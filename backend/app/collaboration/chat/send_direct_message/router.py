from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.core.db import get_db_session
from app.oauth.user import Users
from app.realtime.server import is_user_online, sio
from app.user.dependencies import get_current_user
from .schemas import ConversationPartner, ConversationSummary, MessageCreate, MessageResponse
from .service import start_chat
from .socket_manager import manager

router = APIRouter()


@router.get("/api/v1/chat/conversations", response_model=list[ConversationSummary])
@router.get("/messages/conversations", response_model=list[ConversationSummary])
async def get_my_conversations(
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[ConversationSummary]:
    """Retrieve all conversations for the authenticated user with recent message and unread count."""
    stmt = (
        select(Message)
        .where(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id,
            ),
            Message.team_id.is_(None),
        )
        .order_by(Message.created_at.desc())
    )
    result = await db.execute(stmt)
    all_messages = result.scalars().all()

    # Group by peer ID
    conversations: dict[UUID, dict] = {}
    for msg in all_messages:
        peer_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        if peer_id is None:
            continue

        if peer_id not in conversations:
            conversations[peer_id] = {
                "last_message": msg,
                "unread_count": 0,
            }

        if msg.receiver_id == current_user.id and not msg.is_read:
            conversations[peer_id]["unread_count"] += 1

    if not conversations:
        return []

    # Fetch peer user details
    peer_ids = list(conversations.keys())
    users_stmt = select(Users).where(Users.id.in_(peer_ids))
    users_res = await db.execute(users_stmt)
    peer_records = {u.id: u for u in users_res.scalars().all()}

    summaries: list[ConversationSummary] = []
    for peer_id, data in conversations.items():
        peer_user = peer_records.get(peer_id)
        if not peer_user:
            continue

        summaries.append(
            ConversationSummary(
                peer=ConversationPartner(
                    id=peer_user.id,
                    login=peer_user.login,
                    fullname=peer_user.fullname,
                    avatar_url=peer_user.avatar_url,
                    campus=peer_user.campus or "1337 Benguerir",
                    is_online=is_user_online(peer_user.id),
                ),
                last_message=MessageResponse.model_validate(data["last_message"]),
                unread_count=data["unread_count"],
            )
        )

    return summaries


@router.get("/api/v1/chat/messages/{peer_id}")
async def get_messages_with_peer(
    peer_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[dict[str, str | bool | None]]:
    """Retrieve chat history with a specific peer."""
    stmt = (
        select(Message)
        .where(
            or_(
                (Message.sender_id == current_user.id) & (Message.receiver_id == peer_id),
                (Message.sender_id == peer_id) & (Message.receiver_id == current_user.id),
            ),
            Message.team_id.is_(None),
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
            "receiver_id": str(message.receiver_id) if message.receiver_id else None,
            "is_read": message.is_read,
            "is_delivered": message.is_delivered,
        }
        for message in messages
    ]


@router.get("/messages/{user_a}/{user_b}")
async def get_chat_history(
    user_a: UUID,
    user_b: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[dict[str, str | bool | None]]:
    if current_user.id not in {user_a, user_b}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own conversations",
        )
    stmt = (
        select(Message)
        .where(
            or_(
                (Message.sender_id == user_a) & (Message.receiver_id == user_b),
                (Message.sender_id == user_b) & (Message.receiver_id == user_a),
            ),
            Message.team_id.is_(None),
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
            "receiver_id": str(message.receiver_id) if message.receiver_id else None,
            "is_read": message.is_read,
            "is_delivered": message.is_delivered,
        }
        for message in messages
    ]


@router.post("/api/v1/chat/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_direct_message(
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> MessageResponse:
    """Send a direct message via REST and emit to Socket.IO."""
    if not payload.receiver_id:
        raise HTTPException(status_code=400, detail="receiver_id is required")

    receiver = await db.get(Users, payload.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    participants = sio.manager.get_participants("/chat", f"user:{payload.receiver_id}")
    delivered = next(iter(participants), None) is not None

    message = Message(
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        content=payload.content.strip(),
        is_read=False,
        is_delivered=delivered,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    if delivered:
        await sio.emit(
            "receive_dm",
            {
                "id": str(message.id),
                "from": str(current_user.id),
                "to": str(payload.receiver_id),
                "content": message.content,
                "created_at": message.created_at.isoformat(),
                "offline_message": False,
            },
            room=f"user:{payload.receiver_id}",
            namespace="/chat",
        )

    return MessageResponse.model_validate(message)


@router.post("/api/v1/chat/read/{message_id}")
async def mark_message_as_read(
    message_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> dict[str, str]:
    """Mark a message as read and notify sender."""
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not the receiver of this message")

    if not message.is_read:
        message.is_read = True
        await db.commit()
        await sio.emit(
            "dm_read_receipt",
            {"message_id": str(message.id), "reader_id": str(current_user.id)},
            room=f"user:{message.sender_id}",
            namespace="/chat",
        )

    return {"status": "ok", "message_id": str(message_id)}


@router.websocket("/ws/chat/{user_id}")
async def chat_endpoint(
    websocket: WebSocket,
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    if await db.get(Users, user_id) is None:
        await websocket.close(code=1008, reason="Unknown user")
        return

    await start_chat(websocket, user_id, db)


@router.websocket("/ws/chat/team/{team_id}/{user_id}")
async def team_chat_endpoint(
    websocket: WebSocket,
    team_id: UUID,
    user_id: UUID,
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

            broadcast_payload = json.dumps(
                {"from": str(user_id), "team_id": str(team_id), "content": content}
            )
            await manager.broadcast_to_team(team_id, user_id, broadcast_payload)

    except WebSocketDisconnect:
        manager.disconnect_team(team_id, user_id)


@router.get("/messages/team/{team_id}")
async def get_team_chat_history(
    team_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, str | None]]:
    stmt = select(Message).where(Message.team_id == team_id).order_by(Message.created_at.asc())
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

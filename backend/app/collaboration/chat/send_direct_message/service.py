from __future__ import annotations

import json
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from .socket_manager import manager


async def start_chat(websocket: WebSocket, user_id: UUID, db: AsyncSession) -> None:
    await manager.connect_dm(user_id, websocket)

    stmt = (
        select(Message)
        .where((Message.receiver_id == user_id) & Message.is_read.is_(False))
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(stmt)
    unread_messages = result.scalars().all()

    for msg in unread_messages:
        payload = json.dumps(
            {
                "id": str(msg.id),
                "from": str(msg.sender_id),
                "to": str(msg.receiver_id),
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
                "offline_message": True,
            }
        )
        await websocket.send_text(payload)
        msg.is_delivered = True

    if unread_messages:
        await db.commit()

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                receiver_id = UUID(str(payload["receiver_id"]))
                content = str(payload["content"])
            except (json.JSONDecodeError, KeyError, TypeError, ValueError):
                await websocket.send_json({"error": "Message must contain valid receiver_id and content"})
                continue

            live_message = json.dumps({
                "from": str(user_id),
                "to": str(receiver_id),
                "content": content,
            })

            # Try to push live
            delivered = await manager.send_dm(live_message, receiver_id)

            new_message = Message(
                sender_id=user_id,
                receiver_id=receiver_id,
                content=content,
                is_read=False,
                is_delivered=delivered,
            )
            db.add(new_message)
            await db.commit()

    except WebSocketDisconnect:
        manager.disconnect_dm(user_id)
    except Exception as e:
        manager.disconnect_dm(user_id)
        print(f"[CHAT ERROR] {e}")

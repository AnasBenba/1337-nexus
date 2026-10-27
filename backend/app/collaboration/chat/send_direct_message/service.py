

import json
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect
from app.collaboration.chat.models  import Message
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db_session as get_db
from .socket_manager import manager


async def start_chat(websocket: WebSocket, user_id: UUID, db: AsyncSession):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            riceiver_id = UUID(payload["receiver_id"])
            new_message = Message(
            sender_id=user_id,
            receiver_id=riceiver_id,
            content=payload["content"]
            )
            db.add(new_message)
            await db.commit()
            live_message = json.dumps({"from" : str(user_id), "content": payload["content"]})
            await manager.send_personal_message(live_message, riceiver_id)
    except WebSocketDisconnect:
        manager.disconnect(user_id)
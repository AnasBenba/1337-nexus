

# import json
# from uuid import UUID
# from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends
# from app.collaboration.chat.models  import Message
# from sqlalchemy.ext.asyncio import AsyncSession
# from app.core.db import get_db_session as get_db
# from .socket_manager import manager

# async def start_chat(websocket: WebSocket, user_id: int, db: AsyncSession):
#     await manager.connect(user_id, websocket)
#     try:
#         while True:
#             data = await websocket.receive_text()
#             payload = json.loads(data)
#             riceiver_id = int(payload["receiver_id"])
#             new_message = Message(
#             sender_id=user_id,
#             receiver_id=riceiver_id,
#             content=payload["content"]
#             )
#             db.add(new_message)
#             await db.commit()
#             live_message = json.dumps({"from" : str(user_id), "content": payload["content"]})
#             await manager.send_personal_message(live_message, riceiver_id)
#     except WebSocketDisconnect:
#         manager.disconnect(user_id)
#     except Exception as e:
#         # Fatal crash (e.g., PostgreSQL rejected the dummy UUIDs)
#         manager.disconnect(user_id)
#         print(f"[CHAT CRASH] Exception in socket loop: {e}")

import json
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.collaboration.chat.models import Message
from .socket_manager import manager

async def start_chat(websocket: WebSocket, user_id: int, db: AsyncSession):
    await manager.connect(user_id, websocket)

    # 1. FLUSH UNREAD / OFFLINE MESSAGES UPON CONNECT
    stmt = (
        select(Message)
        .where((Message.receiver_id == user_id) & (Message.is_read == False))
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(stmt)
    unread_messages = result.scalars().all()

    for msg in unread_messages:
        payload = json.dumps({
            "from": msg.sender_id,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
            "offline_message": True
        })
        await websocket.send_text(payload)
        msg.is_read = True

    if unread_messages:
        await db.commit()

    # 2. LISTEN FOR INCOMING MESSAGES
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            receiver_id = int(payload["receiver_id"])
            content = payload["content"]

            live_message = json.dumps({
                "from": user_id,
                "content": content
            })

            # Try to push live
            delivered = await manager.send_personal_message(live_message, receiver_id)

            # Store in DB (is_read = True if live delivery succeeded, else False)
            new_message = Message(
                sender_id=user_id,
                receiver_id=receiver_id,
                content=content,
                is_read=delivered
            )
            db.add(new_message)
            await db.commit()

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        manager.disconnect(user_id)
        print(f"[CHAT ERROR] {e}")
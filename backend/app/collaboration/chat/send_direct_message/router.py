import json
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends
from app.collaboration.chat.models  import Message
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db_session as get_db
from .socket_manager import manager
from app.core.db import get_db_session

from .service import start_chat
from fastapi import Cookie, WebSocketException, status
router = APIRouter()


@router.websocket("/ws/chat/{user_id}")
async def chat_endpoint(
    websocket: WebSocket,
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await start_chat(websocket, user_id, db)

@router.websocket("/ws/chat/team/{team_id}/{user_id}")
async def team_chat_endpoint(
    websocket: WebSocket,
    team_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    await manager.connect_team(team_id, user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            content = payload["content"]

            # Save team message to DB
            new_msg = Message(
                sender_id=user_id,
                team_id=team_id,
                content=content
            )
            db.add(new_msg)
            await db.commit()

            # Broadcast to everyone in the team
            broadcast_payload = json.dumps({
                "from": user_id,
                "team_id": team_id,
                "content": content
            })
            await manager.broadcast_to_team(team_id, user_id, broadcast_payload)

    except WebSocketDisconnect:
        manager.disconnect_team(team_id, user_id)


@router.get("/messages/{user_a}/{user_b}")
async def get_chat_history(
    user_a: int, 
    user_b: int, 
    db: AsyncSession = Depends(get_db_session)
):
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
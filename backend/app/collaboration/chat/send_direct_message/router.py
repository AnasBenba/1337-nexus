from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session

from .service import start_chat

router = APIRouter()


@router.websocket("/ws/chat/{user_id}")
async def chat_endpoint(
    websocket: WebSocket,
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    await start_chat(websocket, user_id, db)

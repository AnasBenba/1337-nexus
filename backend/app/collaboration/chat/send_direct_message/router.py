# from fastapi import Depends, WebSocket, WebSocketDisconnect
# from pytest import Session
# from sqlalchemy.ext.asyncio import AsyncSession
# from app.core.db import get_db_session as get_db


# @app.websocket("/ws/chat/{user_id}")
# async def chat_endpoint(websocket: WebSocket, user_id: str, db: AsyncSession = Depends(get_db)):
#     await websocket.accept()
#     try:
#         while True:
#             data = await websocket.receive_json()
#             received_message = data.get("message")
#             recipient_id = data.get("recipient_id")

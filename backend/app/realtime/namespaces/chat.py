from __future__ import annotations

from http.cookies import SimpleCookie
from typing import Any
from uuid import UUID

import socketio  # type: ignore[import-untyped]
from fastapi import HTTPException
from sqlalchemy import select

from app.collaboration.chat.models import Message
from app.core.db import SessionLocal
from app.oauth.jwt import verify_access_token
from app.oauth.user import Users, get_user_by_intra_id


class ChatNamespace(socketio.AsyncNamespace):  # type: ignore[misc]
    """Socket.IO Namespace for real-time direct peer messaging."""

    def __init__(self, namespace: str = "/chat") -> None:
        super().__init__(namespace=namespace)

    async def on_connect(self, sid: str, environ: dict[str, Any], auth: Any = None) -> bool:
        token = None

        # 1. Try Cookie
        cookies = SimpleCookie()
        cookies.load(environ.get("HTTP_COOKIE", ""))
        token_cookie = cookies.get("access_token")
        if token_cookie:
            token = token_cookie.value

        # 2. Try auth payload
        if not token and isinstance(auth, dict):
            token = auth.get("token") or auth.get("access_token")

        if not token:
            return False

        try:
            claims = verify_access_token(token)
            raw_sub = str(claims["sub"])
        except (HTTPException, KeyError, TypeError, ValueError):
            return False

        async with SessionLocal() as db:
            user = None
            try:
                user_uuid = UUID(raw_sub)
                user = await db.get(Users, user_uuid)
            except ValueError:
                if raw_sub.isdigit():
                    user = await get_user_by_intra_id(db, int(raw_sub))

            if user is None:
                return False

            user_id = user.id
            await self.save_session(sid, {"user_id": user_id})
            await self.enter_room(sid, f"user:{user_id}")

            # Deliver offline messages
            statement = (
                select(Message)
                .where(
                    Message.receiver_id == user_id,
                    Message.is_delivered.is_(False),
                )
                .order_by(Message.created_at.asc())
            )
            result = await db.execute(statement)
            undelivered_messages = result.scalars().all()

            for message in undelivered_messages:
                await self.emit(
                    "receive_dm",
                    {
                        "id": str(message.id),
                        "from": str(message.sender_id),
                        "to": str(message.receiver_id),
                        "content": message.content,
                        "created_at": message.created_at.isoformat() if message.created_at else "",
                        "offline_message": True,
                    },
                    room=sid,
                )
                message.is_delivered = True

            if undelivered_messages:
                await db.commit()

        return True

    async def on_disconnect(self, sid: str) -> None:
        pass

    async def on_send_dm(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid message payload"}

        receiver_id_raw = data.get("receiver_id")
        content = data.get("content")

        try:
            receiver_id = UUID(str(receiver_id_raw))
        except (TypeError, ValueError):
            return {"status": "error", "message": "receiver_id must be a valid UUID"}

        if not isinstance(content, str) or not content.strip():
            return {"status": "error", "message": "content is required"}

        session = await self.get_session(sid)
        sender_id = session.get("user_id") if session else None

        if not isinstance(sender_id, UUID):
            return {"status": "error", "message": "User is not authenticated"}

        async with SessionLocal() as db:
            receiver = await db.get(Users, receiver_id)
            if receiver is None:
                return {"status": "error", "message": "Receiver not found"}

            participants = self.server.manager.get_participants(
                self.namespace,
                f"user:{receiver_id}",
            )
            delivered = next(iter(participants), None) is not None

            message = Message(
                sender_id=sender_id,
                receiver_id=receiver_id,
                content=content.strip(),
                is_read=False,
                is_delivered=delivered,
            )
            db.add(message)
            await db.commit()
            await db.refresh(message)

            if delivered:
                await self.emit(
                    "receive_dm",
                    {
                        "id": str(message.id),
                        "from": str(sender_id),
                        "to": str(receiver_id),
                        "content": message.content,
                        "created_at": message.created_at.isoformat() if message.created_at else "",
                        "offline_message": False,
                    },
                    room=f"user:{receiver_id}",
                )

        return {
            "status": "ok",
            "message_id": str(message.id),
            "delivered": delivered,
        }

    async def on_dm_read(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid payload"}

        message_id_raw = data.get("message_id")
        try:
            parsed_message_id = UUID(str(message_id_raw))
        except (TypeError, ValueError):
            return {"status": "error", "message": "message_id must be a valid UUID"}

        session = await self.get_session(sid)
        user_id = session.get("user_id") if session else None

        if not isinstance(user_id, UUID):
            return {"status": "error", "message": "User is not authenticated"}

        async with SessionLocal() as db:
            message = await db.get(Message, parsed_message_id)
            if message is None:
                return {"status": "error", "message": "Message not found"}

            if message.receiver_id != user_id:
                return {"status": "error", "message": "User is not the receiver"}

            sender_id = message.sender_id
            newly_read = not message.is_read
            if newly_read:
                message.is_read = True
                await db.commit()

        if newly_read:
            await self.emit(
                "dm_read_receipt",
                {"message_id": str(parsed_message_id), "reader_id": str(user_id)},
                room=f"user:{sender_id}",
            )

        return {"status": "ok", "message_id": str(parsed_message_id)}


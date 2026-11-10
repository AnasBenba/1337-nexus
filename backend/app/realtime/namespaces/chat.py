from __future__ import annotations

import logging
from http.cookies import SimpleCookie
from typing import Any
from uuid import UUID

import socketio
from fastapi import HTTPException
from sqlalchemy import select

from app.collaboration.chat.models import Message
from app.core.db import SessionLocal
from app.oauth.jwt import verify_access_token
from app.oauth.user import Users, get_user_by_id, get_user_by_intra_id

logger = logging.getLogger(__name__)


class ChatNamespace(socketio.AsyncNamespace):
    def __init__(self, namespace: str = "/chat") -> None:
        super().__init__(namespace=namespace)

    async def on_connect(self, sid: str, environ: dict, auth: Any = None) -> bool:
        token = None

        # 1. Check auth dictionary (Socket.IO client auth payload)
        if isinstance(auth, dict):
            token = auth.get("token") or auth.get("access_token")

        # 2. Check query string (e.g. ?token=... or ?dev_token=...)
        if not token:
            from urllib.parse import parse_qs
            qs = parse_qs(environ.get("QUERY_STRING", ""))
            candidates = qs.get("token") or qs.get("dev_token")
            if candidates:
                token = candidates[0]

        # 3. Check authorization header
        if not token:
            auth_header = environ.get("HTTP_AUTHORIZATION", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:].strip()

        # 4. Fallback to cookie
        if not token:
            cookies = SimpleCookie()
            cookies.load(environ.get("HTTP_COOKIE", ""))
            token_cookie = cookies.get("access_token")
            if token_cookie:
                token = token_cookie.value

        if not token:
            logger.warning("Chat connection rejected: No authentication token found")
            return False

        try:
            claims = verify_access_token(token)
        except (HTTPException, KeyError, TypeError, ValueError) as err:
            logger.warning("Chat connection rejected: Invalid access token: %s", err)
            return False

        sub = claims.get("sub")
        user_id_claim = claims.get("user_id")

        async with SessionLocal() as db:
            user = None

            # Attempt UUID lookup
            for candidate in [user_id_claim, sub]:
                if candidate:
                    try:
                        user = await get_user_by_id(db, UUID(str(candidate)))
                        if user is not None:
                            break
                    except (ValueError, TypeError):
                        pass

            # Fallback to intra_id lookup
            if user is None and sub is not None:
                try:
                    user = await get_user_by_intra_id(db, int(sub))
                except (ValueError, TypeError):
                    pass

            if user is None:
                logger.warning("Chat connection rejected: User not found in DB")
                return False

            user_id = user.id
            await self.save_session(sid, {"user_id": str(user_id)})
            await self.enter_room(sid, f"user:{str(user_id)}")
            await self.emit("user_status", {"user_id": str(user_id), "is_online": True})

            # Deliver offline messages
            statement = (
                select(Message)
                .where(
                    Message.receiver_id == user_id,
                    Message.team_id.is_(None),
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
                        "created_at": message.created_at.isoformat(),
                        "offline_message": True,
                    },
                    room=sid,
                )
                message.is_delivered = True

            if undelivered_messages:
                await db.commit()

        logger.info("Chat client connected: sid=%s, user_id=%s", sid, user_id)
        return True

    async def on_disconnect(self, sid: str) -> None:
        session = await self.get_session(sid)
        user_id = session.get("user_id") if session else None
        if user_id:
            await self.emit("user_status", {"user_id": str(user_id), "is_online": False})
        logger.info("Chat client disconnected: sid=%s, user_id=%s", sid, user_id)

    async def on_send_dm(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid message payload"}

        receiver_id_raw = data.get("receiver_id") or data.get("to")
        content = data.get("content")

        try:
            receiver_id = UUID(str(receiver_id_raw))
        except (TypeError, ValueError):
            return {"status": "error", "message": "Valid receiver_id is required"}

        if not isinstance(content, str) or not content.strip():
            return {"status": "error", "message": "content is required"}

        session = await self.get_session(sid)
        sender_id_raw = session.get("user_id") if session else None

        if not sender_id_raw:
            return {"status": "error", "message": "User is not authenticated"}

        try:
            sender_id = UUID(str(sender_id_raw))
        except (TypeError, ValueError):
            return {"status": "error", "message": "Invalid authenticated session"}

        async with SessionLocal() as db:
            receiver = await db.get(Users, receiver_id)
            if receiver is None:
                return {"status": "error", "message": "Receiver not found"}

            receiver_room = f"user:{receiver_id}"
            try:
                participants = list(self.server.manager.get_participants(self.namespace, receiver_room))
                delivered = len(participants) > 0
            except Exception:
                delivered = False

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

            # Always broadcast receive_dm event to the receiver's room
            await self.emit(
                "receive_dm",
                {
                    "id": str(message.id),
                    "from": str(sender_id),
                    "to": str(receiver_id),
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                    "offline_message": False,
                },
                room=receiver_room,
            )

        return {
            "status": "ok",
            "message_id": str(message.id),
            "delivered": delivered,
        }

    async def on_dm_read(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid payload"}

        message_id_raw = data.get("message_id") or data.get("id")
        if not message_id_raw:
            return {"status": "error", "message": "message_id is required"}

        try:
            parsed_message_id = UUID(str(message_id_raw))
        except (ValueError, TypeError):
            return {"status": "error", "message": "message_id must be a valid UUID"}

        session = await self.get_session(sid)
        user_id_raw = session.get("user_id") if session else None
        if not user_id_raw:
            return {"status": "error", "message": "User is not authenticated"}

        try:
            user_id = UUID(str(user_id_raw))
        except (ValueError, TypeError):
            return {"status": "error", "message": "Invalid authenticated session"}

        sender_id = None
        newly_read = False

        async with SessionLocal() as db:
            message = await db.get(Message, parsed_message_id)
            if message is None:
                return {"status": "error", "message": "Message not found"}

            if message.receiver_id != user_id:
                return {
                    "status": "error",
                    "message": "User is not the receiver of this message",
                }

            sender_id = message.sender_id
            newly_read = not message.is_read
            if newly_read:
                message.is_read = True
                await db.commit()

        if newly_read and sender_id is not None:
            await self.emit(
                "dm_read_receipt",
                {"message_id": str(parsed_message_id), "reader_id": str(user_id)},
                room=f"user:{sender_id}",
            )

        return {"status": "ok", "message_id": str(parsed_message_id)}

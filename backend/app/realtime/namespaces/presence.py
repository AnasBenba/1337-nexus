from __future__ import annotations

import logging
from http.cookies import SimpleCookie
from typing import Any

import socketio  # type: ignore[import-untyped]
from fastapi import HTTPException
from sqlalchemy import select

from app.core.db import SessionLocal
from app.oauth import jwt
from app.oauth.user import Users
from app.user.friends import presence
from app.user.friends.service import friend_ids

logger = logging.getLogger(__name__)


def _user_room(user_id: int) -> str:
    return f"user:{user_id}"


class PresenceNamespace(socketio.AsyncNamespace):  # type: ignore[misc]
    """/presence: the app keeps one connection open per tab; friends get live online/offline events.

    Server -> client event: "presence" {"user_id": int, "online": bool}
    """

    async def on_connect(self, sid: str, environ: dict[str, Any], auth: Any = None) -> None:
        # Same login cookie as the REST API; the browser sends it with the handshake.
        cookie = SimpleCookie(environ.get("HTTP_COOKIE", ""))
        token = cookie["access_token"].value if "access_token" in cookie else None
        if not token:
            raise socketio.exceptions.ConnectionRefusedError("Not authenticated")
        try:
            payload = jwt.verify_access_token(token)
        except HTTPException as exc:
            raise socketio.exceptions.ConnectionRefusedError(exc.detail) from exc

        async with SessionLocal() as session:
            result = await session.execute(select(Users.id).where(Users.intra_id == int(payload["sub"])))
            user_id = result.scalar_one_or_none()
        if user_id is None:
            raise socketio.exceptions.ConnectionRefusedError("User not found")

        await self.save_session(sid, {"user_id": user_id})
        await self.enter_room(sid, _user_room(user_id))
        if presence.connect(user_id, sid):
            await self._notify_friends(user_id, online=True)

    async def on_disconnect(self, sid: str, *args: Any) -> None:
        session = await self.get_session(sid)
        user_id = session.get("user_id") if session else None
        if user_id is not None and presence.disconnect(user_id, sid):
            await self._notify_friends(user_id, online=False)

    async def _notify_friends(self, user_id: int, online: bool) -> None:
        async with SessionLocal() as session:
            ids = await friend_ids(session, user_id)
        for fid in ids:
            await self.emit("presence", {"user_id": user_id, "online": online}, room=_user_room(fid))

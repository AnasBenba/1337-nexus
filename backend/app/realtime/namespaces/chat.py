from http.cookies import SimpleCookie
from typing import Any
from uuid import UUID

import socketio  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.core.db import SessionLocal, get_db_session
from app.oauth import jwt
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users, get_user_by_intra_id
from app.realtime.presence import presence_manager
from app.teams.models import WorkspaceTeamMember

router = APIRouter()

async def resolve_current_user(
    request: Request,
    db: AsyncSession,
) -> Users:
    """Helper to get authenticated user."""
    return await get_authenticated_user(request=request, db=db)


@router.get("/messages/users/me")
async def get_current_user_profile(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, str | int | None]:
    """Return the current user profile (with dev fallback)."""
    user = await resolve_current_user(request, db)
    return {
        "id": str(user.id),
        "login": user.login,
        "fullname": user.fullname,
        "role": user.role,
        "intra_id": user.intra_id,
    }


@router.get("/api/v1/messages/unread-count")
@router.get("/messages/unread-count")
async def get_unread_messages_count(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    """Return total count of unread direct messages for the current user."""
    user = await resolve_current_user(request, db)
    stmt = select(func.count(Message.id)).where(
        Message.receiver_id == user.id,
        Message.team_id.is_(None),
        Message.is_read.is_(False),
    )
    result = await db.execute(stmt)
    count = result.scalar_one() or 0
    return {"unread_messages": int(count)}


@router.get("/messages/peers")
async def get_peers_list(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    """Return the list of all peers with their online/offline presence status."""
    try:
        current_user: Users | None = await resolve_current_user(request, db)
    except HTTPException:
        current_user = None

    stmt = select(Users).order_by(Users.login.asc())
    result = await db.execute(stmt)
    users = list(result.scalars().all())

    online_ids = presence_manager.get_online_user_ids()

    unread_by_sender: dict[str, int] = {}
    if current_user is not None:
        unread_stmt = (
            select(Message.sender_id, func.count(Message.id))
            .where(
                Message.receiver_id == current_user.id,
                Message.team_id.is_(None),
                Message.is_read.is_(False),
            )
            .group_by(Message.sender_id)
        )
        unread_res = await db.execute(unread_stmt)
        for sender_uid, cnt in unread_res.all():
            unread_by_sender[str(sender_uid)] = int(cnt)

    peers = []
    for u in users:
        uid_str = str(u.id)
        is_self = current_user is not None and u.id == current_user.id
        peers.append(
            {
                "id": uid_str,
                "login": u.login,
                "fullname": u.fullname,
                "role": u.role,
                "is_self": is_self,
                "is_online": uid_str in online_ids,
                "unread_count": unread_by_sender.get(uid_str, 0),
            }
        )
    return peers


@router.get("/messages/team/{team_id}")
async def get_team_chat_history(
    team_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, str | None]]:
    current_user = await resolve_current_user(request, db)

    membership = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team_id,
            WorkspaceTeamMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team",
        )

    statement = (
        select(Message)
        .where(
            Message.team_id == team_id,
            Message.receiver_id.is_(None),
        )
        .order_by(Message.created_at.asc())
    )
    result = await db.execute(statement)
    messages = list(result.scalars().all())
    sender_ids = {m.sender_id for m in messages if m.sender_id is not None}
    users_by_id: dict[UUID, Users] = {}
    if sender_ids:
        users_res = await db.execute(select(Users).where(Users.id.in_(sender_ids)))
        users_by_id = {u.id: u for u in users_res.scalars().all()}

    return [
        {
            "id": str(message.id),
            "team_id": str(message.team_id),
            "sender_id": str(message.sender_id),
            "sender_login": users_by_id[message.sender_id].login
            if message.sender_id in users_by_id
            else None,
            "sender_name": users_by_id[message.sender_id].fullname
            if message.sender_id in users_by_id
            else None,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message in messages
    ]


@router.get("/messages/{user_a}/{user_b}")
async def get_chat_history(
    user_a: UUID,
    user_b: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    current_user = await resolve_current_user(request, db)

    if current_user.id not in {user_a, user_b}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own conversations",
        )
    stmt = (
        select(Message)
        .where(
            ((Message.sender_id == user_a) & (Message.receiver_id == user_b))
            | ((Message.sender_id == user_b) & (Message.receiver_id == user_a))
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
            "is_read": message.is_read,
            "is_delivered": message.is_delivered,
        }
        for message in messages
    ]


class ChatNamespace(socketio.AsyncNamespace):  # type: ignore[misc]
    def __init__(self, namespace: str = "/chat") -> None:
        super().__init__(namespace=namespace)

    async def on_connect(self, sid: str, environ: dict[str, Any], auth: Any = None) -> bool:
        cookies = SimpleCookie()
        cookies.load(environ.get("HTTP_COOKIE", ""))

        user = None
        token_cookie = cookies.get("access_token")
        if token_cookie is not None:
            try:
                claims = jwt.verify_access_token(token_cookie.value)
                async with SessionLocal() as db:
                    try:
                        uid = jwt.user_id_from(claims)
                        user = await db.get(Users, uid)
                    except HTTPException:
                        intra_id = int(claims["sub"])
                        user = await get_user_by_intra_id(db, intra_id)
            except (HTTPException, KeyError, TypeError, ValueError):
                user = None

        if user is None:
            # Fallback for dev testing: accept auth user_id or first user
            async with SessionLocal() as db:
                if isinstance(auth, dict) and auth.get("user_id"):
                    try:
                        user = await db.get(Users, UUID(str(auth["user_id"])))
                    except (ValueError, TypeError):
                        pass
                if user is None:
                    res = await db.execute(select(Users).limit(1))
                    user = res.scalar_one_or_none()

        if user is None:
            return False

        user_id = user.id

        await self.save_session(sid, {"user_id": user_id})
        await self.enter_room(sid, f"user:{user_id}")

        became_online = presence_manager.add_connection(str(user_id), f"chat:{sid}")
        if became_online:
            await self.emit(
                "presence_change",
                {"user_id": str(user_id), "status": "online"},
            )

        # Send identity and current online users directly to newly connected socket
        await self.emit(
            "my_identity",
            {
                "id": str(user.id),
                "login": user.login,
                "fullname": user.fullname,
                "role": user.role,
                "online_user_ids": list(presence_manager.get_online_user_ids()),
            },
            room=sid,
        )

        async with SessionLocal() as db:
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

        return True

    async def on_disconnect(self, sid: str, *args: Any) -> None:
        user_id, is_offline = presence_manager.remove_connection(f"chat:{sid}")
        if is_offline and user_id:
            await self.emit(
                "presence_change",
                {"user_id": user_id, "status": "offline"},
            )

    async def on_send_dm(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid message payload"}

        receiver_id = data.get("receiver_id")
        content = data.get("content")

        try:
            receiver_id = UUID(str(receiver_id))
        except (TypeError, ValueError):
            return {"status": "error", "message": "receiver_id is required"}

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
                is_delivered=False,
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
                        "created_at": message.created_at.isoformat(),
                        "offline_message": False,
                    },
                    room=f"user:{receiver_id}",
                )
                message.is_delivered = True
                await db.commit()

            # Also notify the receiver on the global /presence namespace so their sidebar
            # unread counter updates immediately even when they are not on /messages.
            if self.server is not None:
                await self.server.emit(
                    "new_dm_notification",
                    {
                        "message_id": str(message.id),
                        "from": str(sender_id),
                    },
                    room=f"user:{receiver_id}",
                    namespace="/presence",
                )

        return {
            "status": "ok",
            "message_id": str(message.id),
            "delivered": delivered,
        }

    async def on_dm_read(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid payload"}

        message_id = data.get("message_id")
        if not isinstance(message_id, str):
            return {"status": "error", "message": "message_id is required"}

        try:
            parsed_message_id = UUID(message_id)
        except ValueError:
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
                return {
                    "status": "error",
                    "message": "User is not the receiver of this message",
                }

            sender_id = message.sender_id
            newly_read = not message.is_read
            if newly_read or not message.is_delivered:
                message.is_read = True
                message.is_delivered = True
                await db.commit()

        if newly_read:
            await self.emit(
                "dm_read_receipt",
                {"message_id": message_id, "reader_id": str(user_id)},
                room=f"user:{sender_id}",
            )
            if self.server is not None:
                await self.server.emit(
                    "dm_read_notification",
                    {"message_id": message_id},
                    room=f"user:{user_id}",
                    namespace="/presence",
                )

        return {"status": "ok", "message_id": message_id}

    async def on_join_team(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid payload"}

        try:
            team_id = UUID(str(data.get("team_id")))
        except (TypeError, ValueError):
            return {"status": "error", "message": "team_id must be a valid UUID"}

        session = await self.get_session(sid)
        user_id = session.get("user_id") if session else None
        if not isinstance(user_id, UUID):
            return {"status": "error", "message": "User is not authenticated"}

        async with SessionLocal() as db:
            membership = await db.scalar(
                select(WorkspaceTeamMember).where(
                    WorkspaceTeamMember.team_id == team_id,
                    WorkspaceTeamMember.user_id == user_id,
                )
            )
            if membership is None:
                return {"status": "error", "message": "You are not a member of this team"}
            role = membership.role

        await self.enter_room(sid, f"team:{team_id}")
        return {"status": "ok", "team_id": str(team_id), "role": role}

    async def on_leave_team(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid payload"}

        try:
            team_id = UUID(str(data.get("team_id")))
        except (TypeError, ValueError):
            return {"status": "error", "message": "team_id must be a valid UUID"}

        await self.leave_room(sid, f"team:{team_id}")
        return {"status": "ok", "team_id": str(team_id)}

    async def on_send_team_message(self, sid: str, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {"status": "error", "message": "Invalid payload"}

        try:
            team_id = UUID(str(data.get("team_id")))
        except (TypeError, ValueError):
            return {"status": "error", "message": "team_id must be a valid UUID"}

        content = data.get("content")
        if not isinstance(content, str) or not content.strip():
            return {"status": "error", "message": "content is required"}
        if len(content.strip()) > 4000:
            return {"status": "error", "message": "content cannot exceed 4000 characters"}

        session = await self.get_session(sid)
        sender_id = session.get("user_id") if session else None
        if not isinstance(sender_id, UUID):
            return {"status": "error", "message": "User is not authenticated"}

        async with SessionLocal() as db:
            membership = await db.scalar(
                select(WorkspaceTeamMember).where(
                    WorkspaceTeamMember.team_id == team_id,
                    WorkspaceTeamMember.user_id == sender_id,
                )
            )
            if membership is None:
                return {"status": "error", "message": "You are not a member of this team"}

            message = Message(
                sender_id=sender_id,
                team_id=team_id,
                receiver_id=None,
                content=content.strip(),
                is_read=False,
                is_delivered=False,
            )
            db.add(message)
            await db.commit()
            await db.refresh(message)

            sender_user = await db.get(Users, sender_id)

            member_ids = set(
                (
                    await db.scalars(
                        select(WorkspaceTeamMember.user_id).where(
                            WorkspaceTeamMember.team_id == team_id
                        )
                    )
                ).all()
            )

        payload = {
            "id": str(message.id),
            "team_id": str(team_id),
            "sender_id": str(sender_id),
            "sender_login": sender_user.login if sender_user else None,
            "sender_name": sender_user.fullname if sender_user else None,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        participants = self.server.manager.get_participants(
            self.namespace,
            f"team:{team_id}",
        )
        for participant_sid, _ in participants:
            participant_session = await self.get_session(participant_sid)
            participant_id = (
                participant_session.get("user_id") if participant_session else None
            )
            if participant_id in member_ids:
                await self.emit(
                    "receive_team_message",
                    payload,
                    to=participant_sid,
                )

        return {
            "status": "ok",
            "message_id": str(message.id),
            "team_id": str(team_id),
        }

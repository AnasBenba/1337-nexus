from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.chat.models import Message
from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.realtime.presence import presence_manager
from app.teams.models import WorkspaceTeamMember

router = APIRouter()

DEV_PEERS = [
    {"login": "zombie00Y", "fullname": "Zoubair", "role": "user", "intra_id": 1001},
    {"login": "AnasBenba", "fullname": "Anas Benba", "role": "user", "intra_id": 1002},
    {"login": "aykaouf", "fullname": "Ayoub Kaouf", "role": "user", "intra_id": 1003},
    {"login": "Yassine", "fullname": "Yassine Atmouioud", "role": "user", "intra_id": 1004},
]


async def resolve_current_user(
    request: Request,
    db: AsyncSession,
) -> Users:
    """Helper to get authenticated user or dev fallback user."""
    try:
        return await get_authenticated_user(request=request, db=db)
    except HTTPException:
        # Dev fallback: use first user or seed dev user
        result = await db.execute(select(Users).limit(1))
        user = result.scalar_one_or_none()
        if user:
            return user
        dev_user = Users(
            login="sel-bou",
            fullname="Soufiane El B.",
            role="user",
            intra_id=4242,
        )
        db.add(dev_user)
        await db.commit()
        await db.refresh(dev_user)
        return dev_user


@router.get("/api/v1/users/me")
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


@router.get("/api/v1/users")
@router.get("/messages/peers")
async def get_peers_list(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    """Return the list of all peers with their online/offline presence status."""
    current_user = await resolve_current_user(request, db)

    stmt = select(Users).order_by(Users.login.asc())
    result = await db.execute(stmt)
    users = list(result.scalars().all())

    # If only 1 user exists, seed default peers for dev testing
    if len(users) <= 1:
        for peer_data in DEV_PEERS:
            if not any(u.login == peer_data["login"] for u in users):
                p = Users(**peer_data)
                db.add(p)
        await db.commit()
        refreshed = await db.execute(select(Users).order_by(Users.login.asc()))
        users = list(refreshed.scalars().all())

    online_ids = presence_manager.get_online_user_ids()

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

    membership = await db.get(
        WorkspaceTeamMember,
        (team_id, current_user.id),
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
    return [
        {
            "id": str(message.id),
            "team_id": str(message.team_id),
            "sender_id": str(message.sender_id),
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }
        for message in result.scalars().all()
    ]


@router.get("/messages/{user_a}/{user_b}")
async def get_chat_history(
    user_a: UUID,
    user_b: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, str | None]]:
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
        }
        for message in messages
    ]

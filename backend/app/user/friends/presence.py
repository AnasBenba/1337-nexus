"""Who is online right now: shared across /presence (app-wide) and /chat (messages)."""

from uuid import UUID

from app.realtime.presence import presence_manager


def connect(user_id: UUID | str | int, sid: str) -> bool:
    """Register a connection. True if the user just came online (first tab/socket)."""
    return presence_manager.add_connection(str(user_id), sid)


def disconnect(user_id: UUID | str | int, sid: str) -> bool:
    """Forget a connection. True if the user just went offline (last tab/socket closed)."""
    _, is_offline = presence_manager.remove_connection(sid)
    return is_offline


def is_online(user_id: UUID | str | int) -> bool:
    return presence_manager.is_user_online(str(user_id))

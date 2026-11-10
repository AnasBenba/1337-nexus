"""Who is online right now: user id -> their open Socket.IO connections (one per tab).

ponytail: in-memory, so it only works with a single backend process (entrypoint runs
uvicorn with --workers 1). With several workers, move this to Redis or a DB table.
"""

_connections: dict[int, set[str]] = {}


def connect(user_id: int, sid: str) -> bool:
    """Register a connection. True if the user just came online (first tab)."""
    sids = _connections.setdefault(user_id, set())
    sids.add(sid)
    return len(sids) == 1


def disconnect(user_id: int, sid: str) -> bool:
    """Forget a connection. True if the user just went offline (last tab closed)."""
    sids = _connections.get(user_id)
    if not sids or sid not in sids:
        return False
    sids.discard(sid)
    if sids:
        return False
    del _connections[user_id]
    return True


def is_online(user_id: int) -> bool:
    return user_id in _connections

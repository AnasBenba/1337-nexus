from __future__ import annotations

from typing import Any

import socketio  # type: ignore[import-untyped]

from app.realtime.namespaces.canvas import CanvasNamespace
from app.realtime.namespaces.chat import ChatNamespace

# Async Socket.IO server configured for ASGI
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Register namespaces
canvas_ns = CanvasNamespace("/canvas")
sio.register_namespace(canvas_ns)

chat_ns = ChatNamespace("/chat")
sio.register_namespace(chat_ns)


def get_socketio_server() -> socketio.AsyncServer:
    """Return the global Socket.IO AsyncServer instance."""
    return sio


def is_user_online(user_id: Any) -> bool:
    """Check if a user currently has an active Socket.IO connection in the /chat namespace."""
    if not user_id:
        return False
    try:
        room = f"user:{str(user_id)}"
        participants = list(sio.manager.get_participants("/chat", room))
        return len(participants) > 0
    except Exception:
        return False


def get_socket_app(other_asgi_app: Any = None) -> socketio.ASGIApp:
    """
    Wrap an existing ASGI application (e.g. FastAPI) with the Socket.IO ASGI application.
    Incoming requests matching /socket.io/ are handled by Socket.IO; other requests
    fall through to other_asgi_app.
    """
    return socketio.ASGIApp(
        socketio_server=sio,
        other_asgi_app=other_asgi_app,
        socketio_path="socket.io",
    )

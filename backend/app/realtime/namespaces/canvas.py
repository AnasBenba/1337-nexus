from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import socketio  # type: ignore[import-untyped]

from app.collaboration.canvas.send_update.service import (
    record_canvas_update,
    validate_canvas_payload,
)
from app.core.db import SessionLocal

logger = logging.getLogger(__name__)


class CanvasNamespace(socketio.AsyncNamespace):  # type: ignore[misc]
    """
    Socket.IO AsyncNamespace for real-time collaborative whiteboard synchronization (/canvas).
    Relays binary Yjs CRDT delta updates and awareness events between clients.
    """

    def __init__(self, namespace: str = "/canvas") -> None:
        super().__init__(namespace=namespace)

    async def trigger_event(self, event: str, *args: Any) -> Any:
        """
        Normalize event names with colons (e.g. 'canvas:join' -> 'on_canvas_join')
        so python-socketio can dispatch them to class methods.
        """
        handler_name = "on_" + event.replace(":", "_")
        if hasattr(self, handler_name):
            handler = getattr(self, handler_name)
            if asyncio.iscoroutinefunction(handler):
                return await handler(*args)
            return handler(*args)
        return await super().trigger_event(event, *args)

    async def on_connect(self, sid: str, environ: dict[str, Any], auth: Any = None) -> bool:
        """Handle new client connection to /canvas namespace."""
        logger.info("Canvas client connected: %s", sid)
        return True

    async def on_disconnect(self, sid: str) -> None:
        """Handle client disconnection."""
        session = await self.get_session(sid)
        if session and "document_id" in session:
            room = session["document_id"]
            # Broadcast awareness removal / peer departure if appropriate
            await self.emit(
                "canvas:awareness",
                {"type": "leave", "sid": sid},
                room=room,
                skip_sid=sid,
            )
        logger.info("Canvas client disconnected: %s", sid)

    async def on_canvas_join(self, sid: str, data: Any) -> dict[str, Any]:
        """
        Join a canvas document room.
        Payload expects: {"document_id": "<uuid>"}
        """
        if not isinstance(data, dict) or "document_id" not in data:
            return {"status": "error", "message": "Missing 'document_id' in join payload"}

        try:
            doc_id = uuid.UUID(str(data["document_id"]))
        except (ValueError, TypeError):
            return {"status": "error", "message": "Invalid 'document_id' format; UUID required"}

        room = str(doc_id)
        await self.enter_room(sid, room)
        await self.save_session(sid, {"document_id": room})

        logger.info("Socket %s joined canvas room %s", sid, room)
        return {"status": "ok", "document_id": room}

    async def on_canvas_update(self, sid: str, data: Any) -> dict[str, Any]:
        """
        Handle incoming binary CRDT delta update.
        Validates payload <= 256 KB, logs monotonically in database, and broadcasts to room.
        Data can be raw binary bytes, or dict containing {"data": bytes, "document_id": ...}.
        """
        session = await self.get_session(sid)
        doc_id_str = session.get("document_id") if session else None

        raw_payload: Any = data
        if isinstance(data, dict):
            if "document_id" in data:
                doc_id_str = str(data["document_id"])
            raw_payload = data.get("data")

        if not doc_id_str:
            return {"status": "error", "message": "Client has not joined a canvas room"}

        try:
            doc_id = uuid.UUID(doc_id_str)
        except (ValueError, TypeError):
            return {"status": "error", "message": "Invalid canvas room UUID"}

        # Validate binary bounds (max 256 KB)
        try:
            binary_bytes = validate_canvas_payload(raw_payload)
        except ValueError as err:
            logger.warning("Rejected canvas update from %s: %s", sid, err)
            return {"status": "error", "message": str(err)}

        # Persist to canvas_updates with monotonic sequence number
        async with SessionLocal() as db:
            update = await record_canvas_update(db=db, document_id=doc_id, data=binary_bytes)

        # Broadcast binary delta buffer to all other room members
        await self.emit("canvas:update", binary_bytes, room=str(doc_id), skip_sid=sid)

        return {
            "status": "ok",
            "document_id": str(doc_id),
            "sequence_number": update.sequence_number,
        }

    async def on_canvas_awareness(self, sid: str, data: Any) -> None:
        """
        Relay ephemeral awareness states (remote cursors, presence) to room members.
        Awareness states are transient and not persisted to database.
        """
        session = await self.get_session(sid)
        room = session.get("document_id") if session else None
        if room:
            await self.emit("canvas:awareness", data, room=room, skip_sid=sid)

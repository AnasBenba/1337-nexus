from __future__ import annotations

import asyncio
import os
import uuid
from typing import Any

import pytest
import pytest_asyncio
import socketio
import uvicorn
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://nexus_migrator:nexus_migrator_password@localhost:5433/nexus",
)
os.environ.setdefault(
    "MIGRATION_DATABASE_URL",
    "postgresql+asyncpg://nexus_migrator:nexus_migrator_password@localhost:5433/nexus",
)

from app.collaboration.canvas import (
    MAX_CANVAS_PAYLOAD_BYTES,
    get_document_updates,
    get_or_create_document,
    record_canvas_update,
    validate_canvas_payload,
)
from app.models.canvas import CanvasDocument, CanvasUpdate
from app.realtime.namespaces.canvas import CanvasNamespace

TEST_DB_URL = os.environ["DATABASE_URL"]


@pytest_asyncio.fixture(scope="function")
async def test_engine() -> AsyncEngine:
    engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
def session_factory(test_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest_asyncio.fixture(scope="function")
async def cleanup_canvas_db(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Clean up canvas tables before and after database tests."""
    async with session_factory() as session, session.begin():
        await session.execute(delete(CanvasUpdate))
        await session.execute(delete(CanvasDocument))
    yield
    async with session_factory() as session, session.begin():
        await session.execute(delete(CanvasUpdate))
        await session.execute(delete(CanvasDocument))


# =============================================================================
# Unit Tests: Payload validation & Persistence
# =============================================================================


def test_validate_canvas_payload_valid() -> None:
    data = b"\x01\x02\x03\x04\xff"
    validated = validate_canvas_payload(data)
    assert validated == data


def test_validate_canvas_payload_at_exact_bound() -> None:
    data = b"x" * MAX_CANVAS_PAYLOAD_BYTES
    validated = validate_canvas_payload(data)
    assert len(validated) == MAX_CANVAS_PAYLOAD_BYTES


def test_validate_canvas_payload_exceeds_bound() -> None:
    data = b"x" * (MAX_CANVAS_PAYLOAD_BYTES + 1)
    with pytest.raises(ValueError, match="exceeds limit"):
        validate_canvas_payload(data)


def test_validate_canvas_payload_rejects_non_binary() -> None:
    with pytest.raises(ValueError, match="Expected binary payload"):
        validate_canvas_payload("not-bytes-string")  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_record_canvas_update_monotonic_sequence(
    session_factory: async_sessionmaker[AsyncSession],
    cleanup_canvas_db: None,
) -> None:
    doc_id = uuid.uuid4()
    async with session_factory() as db:
        await get_or_create_document(db, doc_id, "Test Board")

    # Record 3 updates sequentially
    deltas = [b"\x00\x01", b"\x02\x03", b"\x04\x05"]
    for idx, delta in enumerate(deltas, start=1):
        async with session_factory() as db:
            update = await record_canvas_update(db, doc_id, delta)
            assert update.sequence_number == idx
            assert update.data == delta

    # Verify retrieval
    async with session_factory() as db:
        updates = await get_document_updates(db, doc_id, since_sequence=0)
        assert len(updates) == 3
        assert [u.sequence_number for u in updates] == [1, 2, 3]


# =============================================================================
# Realtime Integration Tests: Socket.IO Binary CRDT Relay
# =============================================================================


@pytest.mark.asyncio
async def test_socketio_two_clients_binary_relay_without_packet_loss() -> None:
    """
    Acceptance Criteria:
    Two connected WebSocket clients in the same room can send and receive binary
    buffers without packet loss.
    """
    test_sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
    canvas_ns = CanvasNamespace("/canvas")
    test_sio.register_namespace(canvas_ns)
    asgi_app = socketio.ASGIApp(test_sio, socketio_path="socket.io")

    # Ephemeral port
    port = 8765
    config = uvicorn.Config(asgi_app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())
    await asyncio.sleep(0.3)

    client1 = socketio.AsyncClient()
    client2 = socketio.AsyncClient()

    received_updates_c2: list[bytes] = []
    received_awareness_c2: list[dict[str, Any]] = []

    @client2.on("canvas:update", namespace="/canvas")
    def on_c2_update(data: bytes) -> None:
        received_updates_c2.append(data)

    @client2.on("canvas:awareness", namespace="/canvas")
    def on_c2_awareness(data: dict[str, Any]) -> None:
        received_awareness_c2.append(data)

    try:
        url = f"http://127.0.0.1:{port}"
        await client1.connect(url, namespaces=["/canvas"])
        await client2.connect(url, namespaces=["/canvas"])

        doc_id = str(uuid.uuid4())

        # Both clients join the same whiteboard room
        ack1 = await client1.call("canvas:join", {"document_id": doc_id}, namespace="/canvas")
        ack2 = await client2.call("canvas:join", {"document_id": doc_id}, namespace="/canvas")

        assert ack1["status"] == "ok"
        assert ack2["status"] == "ok"
        assert ack1["document_id"] == doc_id

        # 1. Client 1 sends a Yjs binary delta buffer to the room
        yjs_delta = b"\x01\x02\x03\x04\x05YJS_BINARY_DELTA\xfe\xff"
        update_ack = await client1.call("canvas:update", yjs_delta, namespace="/canvas")

        assert update_ack["status"] == "ok"
        assert update_ack["sequence_number"] == 1

        # Wait for socket packet transmission
        await asyncio.sleep(0.2)

        # Assert Client 2 received the binary buffer without packet loss
        assert len(received_updates_c2) == 1
        assert received_updates_c2[0] == yjs_delta

        # 2. Client 1 emits ephemeral awareness state (remote cursor)
        awareness_data = {"user": "Alice", "cursor": {"x": 150, "y": 300}}
        await client1.emit("canvas:awareness", awareness_data, namespace="/canvas")

        await asyncio.sleep(0.2)

        # Assert Client 2 received the awareness packet
        assert len(received_awareness_c2) == 1
        assert received_awareness_c2[0] == awareness_data

        # 3. Payload size bound validation: reject buffers > 256 KB
        oversized_buffer = b"X" * (MAX_CANVAS_PAYLOAD_BYTES + 1024)
        error_ack = await client1.call("canvas:update", oversized_buffer, namespace="/canvas")

        assert error_ack["status"] == "error"
        assert "exceeds limit" in error_ack["message"]

        # Ensure Client 2 did NOT receive the oversized packet
        await asyncio.sleep(0.1)
        assert len(received_updates_c2) == 1

    finally:
        await client1.disconnect()
        await client2.disconnect()
        server.should_exit = True
        await server_task

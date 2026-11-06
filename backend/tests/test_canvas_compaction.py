from __future__ import annotations

import os
import uuid

import pycrdt
import pytest
import pytest_asyncio
from sqlalchemy import delete, text
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

from app.collaboration.canvas.compact_document.service import (
    compact_canvas_document,
    get_canvas_advisory_lock_key,
    maybe_compact_canvas_document,
    merge_updates_with_snapshot,
)
from app.collaboration.canvas.join_canvas.service import (
    get_document_updates,
    get_or_create_document,
)
from app.collaboration.canvas.send_update.service import record_canvas_update
from app.models.canvas import CanvasDocument, CanvasUpdate

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


@pytest_asyncio.fixture(scope="function", autouse=True)
async def cleanup_canvas_db(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Clean up canvas tables before and after each test."""
    async with session_factory() as session, session.begin():
        await session.execute(delete(CanvasUpdate))
        await session.execute(delete(CanvasDocument))
    yield
    async with session_factory() as session, session.begin():
        await session.execute(delete(CanvasUpdate))
        await session.execute(delete(CanvasDocument))


# =============================================================================
# Unit Tests: Pycrdt Merging & Lock Keys
# =============================================================================


def test_get_canvas_advisory_lock_key_deterministic() -> None:
    doc_id = uuid.UUID("12345678-1234-5678-1234-567812345678")
    key1 = get_canvas_advisory_lock_key(doc_id)
    key2 = get_canvas_advisory_lock_key(doc_id)
    assert key1 == key2
    assert isinstance(key1, int)
    # Must fit in signed 64-bit int (-2^63 to 2^63 - 1)
    assert -(2**63) <= key1 <= (2**63 - 1)


def test_merge_updates_with_snapshot_pycrdt() -> None:
    # 1. Create client updates
    client = pycrdt.Doc()
    text_elem = client.get("content", type=pycrdt.Text)

    with client.transaction():
        text_elem += "Hello "
    u1 = client.get_update()

    with client.transaction():
        text_elem += "World!"
    u2 = client.get_update()

    # 2. Merge into single snapshot
    snapshot = merge_updates_with_snapshot(b"", [u1, u2])
    assert len(snapshot) > 0

    # 3. Verify clean doc reconstructs exact state
    reconstructed = pycrdt.Doc()
    reconstructed.apply_update(snapshot)
    rec_text = reconstructed.get("content", type=pycrdt.Text)
    assert str(rec_text) == "Hello World!"


def test_merge_updates_with_existing_snapshot() -> None:
    # Initial snapshot with initial elements
    doc1 = pycrdt.Doc()
    arr = doc1.get("items", type=pycrdt.Array)
    with doc1.transaction():
        arr.append("first")
    initial_snapshot = doc1.get_update()

    # Client receives initial snapshot and adds more items
    client = pycrdt.Doc()
    client.apply_update(initial_snapshot)
    client_arr = client.get("items", type=pycrdt.Array)
    with client.transaction():
        client_arr.append("second")
    u2 = client.get_update()

    # Merge existing snapshot + incremental update
    new_snapshot = merge_updates_with_snapshot(initial_snapshot, [u2])

    # Reconstruct in fresh document
    doc3 = pycrdt.Doc()
    doc3.apply_update(new_snapshot)
    doc3_arr = doc3.get("items", type=pycrdt.Array)
    assert list(doc3_arr) == ["first", "second"]


# =============================================================================
# Integration Tests: Compaction Engine & Advisory Locks
# =============================================================================


@pytest.mark.asyncio
async def test_advisory_lock_prevents_concurrent_compaction(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    doc_id = uuid.uuid4()
    async with session_factory() as db:
        await get_or_create_document(db, doc_id, "Advisory Lock Canvas")

    key = get_canvas_advisory_lock_key(doc_id)

    # Session 1 holds advisory xact lock
    async with session_factory() as db1, db1.begin():
        res1 = await db1.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"),
            {"key": key},
        )
        assert res1.scalar_one() is True

        # Session 2 attempts compaction on same document; should skip cleanly
        async with session_factory() as db2:
            result = await compact_canvas_document(db2, doc_id)
            assert result is None


@pytest.mark.asyncio
async def test_compact_canvas_document_purges_updates_at_or_below_watermark(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    doc_id = uuid.uuid4()
    async with session_factory() as db:
        await get_or_create_document(db, doc_id, "Compaction Test")

    # Generate 5 updates using pycrdt
    client = pycrdt.Doc()
    elements = client.get("elements", type=pycrdt.Array)
    updates_data: list[bytes] = []

    for i in range(5):
        with client.transaction():
            elements.append(f"item_{i}")
        updates_data.append(client.get_update())

    for u in updates_data:
        async with session_factory() as db:
            await record_canvas_update(db, doc_id, u, auto_compact=False)

    # Verify 5 updates recorded
    async with session_factory() as db:
        db_updates = await get_document_updates(db, doc_id)
        assert len(db_updates) == 5

    # Run compaction
    async with session_factory() as db:
        result = await compact_canvas_document(db, doc_id)
        assert result is not None
        assert result.compacted_updates_count == 5
        assert result.watermark == 5
        assert result.purged is True

    # Verify database state after compaction
    async with session_factory() as db:
        doc = await db.get(CanvasDocument, doc_id)
        assert doc is not None
        assert len(doc.snapshot) > 0

        # Updates at or below watermark 5 should be purged
        remaining_updates = await get_document_updates(db, doc_id)
        assert len(remaining_updates) == 0

        # Reconstructed document matches expected 5 items
        reconstructed = pycrdt.Doc()
        reconstructed.apply_update(doc.snapshot)
        rec_elements = reconstructed.get("elements", type=pycrdt.Array)
        assert list(rec_elements) == [f"item_{i}" for i in range(5)]


@pytest.mark.asyncio
async def test_compact_canvas_document_preserves_updates_after_watermark(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    doc_id = uuid.uuid4()
    async with session_factory() as db:
        await get_or_create_document(db, doc_id, "Watermark Test")

    client = pycrdt.Doc()
    items = client.get("items", type=pycrdt.Array)

    for i in range(5):
        with client.transaction():
            items.append(f"item_{i}")
        async with session_factory() as db:
            await record_canvas_update(db, doc_id, client.get_update(), auto_compact=False)

    # Compact only up to watermark = 3
    async with session_factory() as db:
        result = await compact_canvas_document(db, doc_id, watermark=3)
        assert result is not None
        assert result.compacted_updates_count == 3
        assert result.watermark == 3

    # Updates 4 and 5 must be preserved
    async with session_factory() as db:
        remaining = await get_document_updates(db, doc_id)
        assert len(remaining) == 2
        assert [u.sequence_number for u in remaining] == [4, 5]

        # Snapshot incorporates items 0, 1, 2
        doc = await db.get(CanvasDocument, doc_id)
        assert doc is not None
        test_doc = pycrdt.Doc()
        test_doc.apply_update(doc.snapshot)
        assert list(test_doc.get("items", type=pycrdt.Array)) == ["item_0", "item_1", "item_2"]


@pytest.mark.asyncio
async def test_maybe_compact_canvas_document_threshold_trigger(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    doc_id = uuid.uuid4()
    async with session_factory() as db:
        await get_or_create_document(db, doc_id, "Threshold Test")

    client = pycrdt.Doc()
    items = client.get("items", type=pycrdt.Array)

    # Insert 3 updates with threshold = 5
    for i in range(3):
        with client.transaction():
            items.append(f"item_{i}")
        async with session_factory() as db:
            await record_canvas_update(db, doc_id, client.get_update(), auto_compact=False)

    async with session_factory() as db:
        res = await maybe_compact_canvas_document(db, doc_id, threshold=5)
        assert res is None  # Below threshold

    # Add 2 more updates (now 5 updates in total)
    for i in range(3, 5):
        with client.transaction():
            items.append(f"item_{i}")
        async with session_factory() as db:
            await record_canvas_update(db, doc_id, client.get_update(), auto_compact=False)

    async with session_factory() as db:
        res = await maybe_compact_canvas_document(db, doc_id, threshold=5)
        assert res is not None
        assert res.compacted_updates_count == 5
        assert res.purged is True


# =============================================================================
# Acceptance Criterion Test: 500 Incremental Updates Compaction
# =============================================================================


@pytest.mark.asyncio
async def test_500_incremental_canvas_updates_triggers_compaction(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Acceptance Criteria:
    Generating 500 incremental canvas updates triggers compaction,
    leaving a consolidated binary snapshot and zero orphaned log entries.
    """
    doc_id = uuid.uuid4()
    async with session_factory() as db:
        await get_or_create_document(db, doc_id, "Acceptance Whiteboard")

    client = pycrdt.Doc()
    nodes = client.get("whiteboard_nodes", type=pycrdt.Array)

    # Generate 500 incremental updates with auto_compact=True and threshold=500
    for i in range(500):
        with client.transaction():
            nodes.append(f"node_{i}")
        delta = client.get_update()

        async with session_factory() as db:
            await record_canvas_update(
                db=db,
                document_id=doc_id,
                data=delta,
                auto_compact=True,
                compaction_threshold=500,
            )

    # Verify:
    # 1. Consolidated binary snapshot exists and is non-empty
    # 2. Zero orphaned log entries remain in canvas_updates
    async with session_factory() as db:
        doc = await db.get(CanvasDocument, doc_id)
        assert doc is not None
        assert len(doc.snapshot) > 0, "Consolidated binary snapshot must not be empty"

        remaining_updates = await get_document_updates(db, doc_id)
        assert len(remaining_updates) == 0, "Expected zero orphaned log entries after compaction"

        # 3. New joining client gets the exact complete state with all 500 nodes
        fresh_client = pycrdt.Doc()
        fresh_client.apply_update(doc.snapshot)
        fresh_nodes = fresh_client.get("whiteboard_nodes", type=pycrdt.Array)
        assert len(fresh_nodes) == 500
        assert fresh_nodes[0] == "node_0"
        assert fresh_nodes[499] == "node_499"

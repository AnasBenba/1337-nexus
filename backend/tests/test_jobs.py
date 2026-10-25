from __future__ import annotations

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

# Ensure required environment variables exist for backend settings
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://nexus_migrator:nexus_migrator_password@localhost:5433/nexus",
)
os.environ.setdefault(
    "MIGRATION_DATABASE_URL",
    "postgresql+asyncpg://nexus_migrator:nexus_migrator_password@localhost:5433/nexus",
)
os.environ.setdefault("TRUSTED_PROXY_SUBNET", "172.28.0.0/24")

from app.jobs.registry import register
from app.jobs.worker import JobWorker
from app.models.job import AIJob

TEST_DB_URL = os.environ["DATABASE_URL"]


@pytest_asyncio.fixture(scope="function")
async def test_engine() -> AsyncEngine:
    engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
def session_factory(test_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest_asyncio.fixture(autouse=True)
async def cleanup_jobs(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Clean up ai_jobs table before and after each test for total test isolation."""
    async with session_factory() as session, session.begin():
        await session.execute(delete(AIJob))
    yield
    async with session_factory() as session, session.begin():
        await session.execute(delete(AIJob))


@pytest.mark.asyncio
async def test_acceptance_criterion_single_job_success(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Acceptance criterion:
    Inserting a mock job row into ai_jobs makes the background worker loop
    pick it up, lock it, execute it, and mark it succeeded.
    """
    job_id = uuid.uuid4()
    async with session_factory() as session, session.begin():
        session.add(
            AIJob(
                id=job_id,
                job_type="echo",
                status="pending",
                payload={"greeting": "hello 1337"},
            )
        )

    worker = JobWorker(
        session_factory=session_factory,
        poll_interval=0.05,
    )

    claimed = await worker.run_once()
    assert claimed == 1

    async with session_factory() as session:
        result = await session.execute(select(AIJob).where(AIJob.id == job_id))
        job = result.scalar_one()

        assert job.status == "succeeded"
        assert job.result == {"echo": {"greeting": "hello 1337"}}
        assert job.attempts == 1
        assert job.error_message is None
        assert job.locked_by is None
        assert job.lease_expires_at is None


@pytest.mark.asyncio
async def test_two_workers_never_run_same_job(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Two workers running simultaneously claim jobs with FOR UPDATE SKIP LOCKED
    and never execute or duplicate the same job.
    """
    executed_ids: list[str] = []
    lock = asyncio.Lock()

    @register("concurrent_test")
    async def concurrent_executor(payload: dict[str, Any]) -> dict[str, Any]:
        async with lock:
            executed_ids.append(payload["item"])
        await asyncio.sleep(0.05)
        return {"processed": payload["item"]}

    job_count = 6
    for i in range(job_count):
        async with session_factory() as session, session.begin():
            session.add(
                AIJob(
                    job_type="concurrent_test",
                    status="pending",
                    payload={"item": f"job-{i}"},
                )
            )

    worker1 = JobWorker(
        session_factory=session_factory,
        worker_id="worker-alpha",
        max_concurrency=4,
    )
    worker2 = JobWorker(
        session_factory=session_factory,
        worker_id="worker-beta",
        max_concurrency=4,
    )

    # Run both workers concurrently
    await asyncio.gather(
        worker1.run_once(max_jobs=4),
        worker2.run_once(max_jobs=4),
    )

    # Process any remaining
    await worker1.run_once()
    await worker2.run_once()

    # Verify no duplicates
    assert len(executed_ids) == job_count
    assert len(set(executed_ids)) == job_count

    # Verify all succeeded in DB
    async with session_factory() as session:
        res = await session.execute(select(AIJob))
        jobs = res.scalars().all()
        assert len(jobs) == job_count
        assert all(j.status == "succeeded" for j in jobs)


@pytest.mark.asyncio
async def test_concurrency_limit_respected(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Worker respects max_concurrency limit when more pending jobs exist than available slots.
    """
    max_active_observed = 0
    current_active = 0
    lock = asyncio.Lock()

    @register("concurrency_check")
    async def slow_executor(payload: dict[str, Any]) -> dict[str, Any]:
        nonlocal current_active, max_active_observed
        async with lock:
            current_active += 1
            if current_active > max_active_observed:
                max_active_observed = current_active

        await asyncio.sleep(0.1)

        async with lock:
            current_active -= 1
        return {"status": "ok"}

    # Insert 6 jobs
    for i in range(6):
        async with session_factory() as session, session.begin():
            session.add(
                AIJob(
                    job_type="concurrency_check",
                    status="pending",
                    payload={"index": i},
                )
            )

    worker = JobWorker(
        session_factory=session_factory,
        max_concurrency=2,
    )

    # Start worker in background
    await worker.start()

    # Wait for all jobs to complete
    for _ in range(50):
        await asyncio.sleep(0.05)
        async with session_factory() as session:
            res = await session.execute(select(AIJob).where(AIJob.status == "succeeded"))
            if len(res.scalars().all()) == 6:
                break

    await worker.stop()

    assert max_active_observed <= 2


@pytest.mark.asyncio
async def test_expired_lease_gets_reclaimed(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    A job left in 'running' state whose lease expired in the past is reclaimed and completed.
    """
    job_id = uuid.uuid4()
    expired_time = datetime.now(UTC) - timedelta(minutes=5)

    async with session_factory() as session, session.begin():
        session.add(
            AIJob(
                id=job_id,
                job_type="echo",
                status="running",
                locked_by="dead-worker",
                locked_at=expired_time,
                lease_expires_at=expired_time,
                attempts=1,
                max_attempts=3,
                payload={"msg": "reclaimed"},
            )
        )

    worker = JobWorker(session_factory=session_factory, worker_id="reclaimer")
    claimed = await worker.run_once()
    assert claimed == 1

    async with session_factory() as session:
        result = await session.execute(select(AIJob).where(AIJob.id == job_id))
        job = result.scalar_one()

        assert job.status == "succeeded"
        assert job.attempts == 2
        assert job.result == {"echo": {"msg": "reclaimed"}}


@pytest.mark.asyncio
async def test_failing_executor_retries_and_marks_failed(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Failing executor retries if attempts < max_attempts, then fails permanently.
    """

    @register("fail_test")
    async def fail_executor(payload: dict[str, Any]) -> dict[str, Any]:
        raise ValueError("Simulated handler crash")

    job_id = uuid.uuid4()
    async with session_factory() as session, session.begin():
        session.add(
            AIJob(
                id=job_id,
                job_type="fail_test",
                status="pending",
                attempts=0,
                max_attempts=2,
                payload={"data": 123},
            )
        )

    worker = JobWorker(session_factory=session_factory)

    # Attempt 1
    await worker.run_once()
    async with session_factory() as session:
        j1 = (await session.execute(select(AIJob).where(AIJob.id == job_id))).scalar_one()
        assert j1.status == "pending"
        assert j1.attempts == 1
        assert "Simulated handler crash" in (j1.error_message or "")
        assert j1.locked_by is None

    # Attempt 2 (reaches max_attempts)
    await worker.run_once()
    async with session_factory() as session:
        j2 = (await session.execute(select(AIJob).where(AIJob.id == job_id))).scalar_one()
        assert j2.status == "failed"
        assert j2.attempts == 2
        assert "Simulated handler crash" in (j2.error_message or "")


@pytest.mark.asyncio
async def test_unknown_job_type_marks_failed_without_crashing_loop(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Unknown job type marks job as failed with clear error without crashing worker loop.
    """
    job_id = uuid.uuid4()
    valid_id = uuid.uuid4()

    async with session_factory() as session, session.begin():
        session.add(
            AIJob(
                id=job_id,
                job_type="unknown.type.xyz",
                status="pending",
                payload={},
            )
        )
        session.add(
            AIJob(
                id=valid_id,
                job_type="echo",
                status="pending",
                payload={"k": "v"},
            )
        )

    worker = JobWorker(session_factory=session_factory)
    await worker.run_once()

    async with session_factory() as session:
        bad_job = (await session.execute(select(AIJob).where(AIJob.id == job_id))).scalar_one()
        assert bad_job.status == "failed"
        assert "Unknown job type" in (bad_job.error_message or "")

        good_job = (await session.execute(select(AIJob).where(AIJob.id == valid_id))).scalar_one()
        assert good_job.status == "succeeded"


@pytest.mark.asyncio
async def test_lease_renewal_keeps_long_job_alive(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Heartbeat extends lease duration so a slow job is not stolen while running.
    """

    @register("slow_task")
    async def slow_task_executor(payload: dict[str, Any]) -> dict[str, Any]:
        await asyncio.sleep(0.35)
        return {"done": True}

    job_id = uuid.uuid4()
    async with session_factory() as session, session.begin():
        session.add(
            AIJob(
                id=job_id,
                job_type="slow_task",
                status="pending",
                payload={},
            )
        )

    worker = JobWorker(
        session_factory=session_factory,
        lease_duration=0.2,
        heartbeat_interval=0.08,
    )

    await worker.run_once()

    async with session_factory() as session:
        job = (await session.execute(select(AIJob).where(AIJob.id == job_id))).scalar_one()
        assert job.status == "succeeded"
        assert job.result == {"done": True}


@pytest.mark.asyncio
async def test_graceful_shutdown(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    Worker starts and stops cleanly via start() and stop().
    """
    worker = JobWorker(session_factory=session_factory, poll_interval=0.1)
    await worker.start()
    assert worker.is_running is True

    await asyncio.sleep(0.05)
    await worker.stop()
    assert worker.is_running is False


@pytest.mark.asyncio
async def test_enqueue_job_helper(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    """
    enqueue_job creates an AIJob in pending status within the caller transaction.
    """
    from app.jobs.service import enqueue_job

    async with session_factory() as session, session.begin():
        job = await enqueue_job(
            session=session,
            job_type="echo",
            payload={"test_key": "test_val"},
            max_attempts=5,
        )
        job_id = job.id

    async with session_factory() as session:
        persisted = (await session.execute(select(AIJob).where(AIJob.id == job_id))).scalar_one()
        assert persisted.job_type == "echo"
        assert persisted.status == "pending"
        assert persisted.payload == {"test_key": "test_val"}
        assert persisted.max_attempts == 5


@pytest.mark.asyncio
async def test_job_worker_lifespan() -> None:
    """
    job_worker_lifespan starts the worker on enter and stops on exit.
    """
    from app.jobs.worker import job_worker_lifespan

    async with job_worker_lifespan() as worker:
        assert worker.is_running is True

    assert worker.is_running is False

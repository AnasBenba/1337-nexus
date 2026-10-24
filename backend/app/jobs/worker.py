from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import signal
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, or_, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.db import SessionLocal
from app.jobs.registry import UnknownJobTypeError, get_executor
from app.models.job import AIJob

logger = logging.getLogger("1337nexus.jobs.worker")


class JobWorker:
    """
    Transactional background job worker using PostgreSQL `FOR UPDATE SKIP LOCKED`.
    Supports concurrency limits, atomic claiming, lease heartbeat renewal,
    retries with backoff, and graceful shutdown.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        worker_id: str | None = None,
        max_concurrency: int | None = None,
        poll_interval: float | None = None,
        lease_duration: float | None = None,
        heartbeat_interval: float | None = None,
        shutdown_timeout: float | None = None,
    ) -> None:
        self.session_factory = session_factory or SessionLocal
        self.worker_id = worker_id or os.getenv("JOB_WORKER_ID") or f"worker-{uuid.uuid4().hex[:8]}"
        self.max_concurrency = (
            max_concurrency
            if max_concurrency is not None
            else int(os.getenv("JOB_WORKER_CONCURRENCY", "5"))
        )
        self.poll_interval = (
            poll_interval
            if poll_interval is not None
            else float(os.getenv("JOB_WORKER_POLL_INTERVAL", "1.0"))
        )
        self.lease_duration = (
            lease_duration
            if lease_duration is not None
            else float(os.getenv("JOB_WORKER_LEASE_SECONDS", "30.0"))
        )
        self.heartbeat_interval = (
            heartbeat_interval
            if heartbeat_interval is not None
            else float(os.getenv("JOB_WORKER_HEARTBEAT_SECONDS", "10.0"))
        )
        self.shutdown_timeout = (
            shutdown_timeout
            if shutdown_timeout is not None
            else float(os.getenv("JOB_WORKER_SHUTDOWN_TIMEOUT", "15.0"))
        )

        self._running = False
        self._loop_task: asyncio.Task[None] | None = None
        self._in_flight_tasks: set[asyncio.Task[None]] = set()

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def in_flight_count(self) -> int:
        return len(self._in_flight_tasks)

    async def start(self) -> None:
        """Start the background worker polling loop."""
        if self._running:
            logger.warning("Worker [%s] is already running", self.worker_id)
            return

        self._running = True
        logger.info(
            "Starting worker [%s] (concurrency=%d, lease=%.1fs, poll=%.1fs)",
            self.worker_id,
            self.max_concurrency,
            self.lease_duration,
            self.poll_interval,
        )
        self._loop_task = asyncio.create_task(
            self._poll_loop(), name=f"worker-loop-{self.worker_id}"
        )

    async def stop(self, drain_timeout: float | None = None) -> None:
        """Gracefully stop the worker, waiting for in-flight tasks to complete."""
        if not self._running:
            return

        logger.info("Stopping worker [%s]...", self.worker_id)
        self._running = False

        if self._loop_task and not self._loop_task.done():
            self._loop_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._loop_task

        timeout_to_use = drain_timeout if drain_timeout is not None else self.shutdown_timeout
        if self._in_flight_tasks:
            logger.info(
                "Waiting up to %.1fs for %d in-flight job(s) to finish...",
                timeout_to_use,
                len(self._in_flight_tasks),
            )
            done, pending = await asyncio.wait(self._in_flight_tasks, timeout=timeout_to_use)

            if pending:
                logger.warning(
                    "%d job(s) did not finish within timeout; cancelling them...",
                    len(pending),
                )
                for task in pending:
                    task.cancel()
                await asyncio.gather(*pending, return_exceptions=True)

        logger.info("Worker [%s] stopped successfully", self.worker_id)

    async def _poll_loop(self) -> None:
        """Main polling loop with exponential backoff on database errors."""
        db_error_backoff = 1.0

        while self._running:
            try:
                claimed_count = await self._claim_and_spawn_jobs()
                db_error_backoff = 1.0  # Reset backoff on successful query

                if claimed_count == 0:
                    await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(
                    "Transient error in worker [%s] polling loop: %s. Retrying in %.1fs...",
                    self.worker_id,
                    e,
                    db_error_backoff,
                )
                try:
                    await asyncio.sleep(db_error_backoff)
                except asyncio.CancelledError:
                    break
                db_error_backoff = min(db_error_backoff * 2.0, 30.0)

    async def run_once(self, max_jobs: int | None = None) -> int:
        """
        Poll, claim, and wait for a batch of jobs to complete.
        Useful for deterministic testing and manual processing cycles.
        """
        claimed_count = await self._claim_and_spawn_jobs(max_jobs=max_jobs)
        if self._in_flight_tasks:
            await asyncio.gather(*list(self._in_flight_tasks), return_exceptions=True)
        return claimed_count

    async def _claim_and_spawn_jobs(self, max_jobs: int | None = None) -> int:
        """Select pending or expired-lease jobs using SKIP LOCKED and spawn worker tasks."""
        free_slots = self.max_concurrency - len(self._in_flight_tasks)
        if free_slots <= 0:
            return 0

        slots_to_claim = min(free_slots, max_jobs) if max_jobs is not None else free_slots

        claimed_jobs: list[dict[str, Any]] = []

        async with self.session_factory() as session, session.begin():
            now = datetime.now(UTC)
            lease_expiry = now + timedelta(seconds=self.lease_duration)

            stmt = (
                select(AIJob)
                .where(
                    or_(
                        AIJob.status == "pending",
                        and_(
                            AIJob.status == "running",
                            AIJob.lease_expires_at.is_not(None),
                            AIJob.lease_expires_at < now,
                        ),
                    )
                )
                .order_by(AIJob.created_at.asc())
                .limit(slots_to_claim)
                .with_for_update(skip_locked=True)
            )

            result = await session.execute(stmt)
            jobs = list(result.scalars().all())

            for job in jobs:
                job.status = "running"
                job.locked_by = self.worker_id
                job.locked_at = now
                job.lease_expires_at = lease_expiry
                job.attempts += 1
                job.updated_at = now

                claimed_jobs.append(
                    {
                        "id": job.id,
                        "job_type": job.job_type,
                        "payload": job.payload or {},
                        "attempts": job.attempts,
                        "max_attempts": job.max_attempts,
                    }
                )

        # Spawn asynchronous execution tasks outside the claim transaction
        for job_data in claimed_jobs:
            task = asyncio.create_task(
                self._execute_job(
                    job_id=job_data["id"],
                    job_type=job_data["job_type"],
                    payload=job_data["payload"],
                    attempts=job_data["attempts"],
                    max_attempts=job_data["max_attempts"],
                ),
                name=f"job-{job_data['id']}",
            )
            self._in_flight_tasks.add(task)
            task.add_done_callback(self._in_flight_tasks.discard)

        if claimed_jobs:
            logger.info("Worker [%s] claimed %d job(s)", self.worker_id, len(claimed_jobs))

        return len(claimed_jobs)

    async def _execute_job(
        self,
        job_id: uuid.UUID,
        job_type: str,
        payload: dict[str, Any],
        attempts: int,
        max_attempts: int,
    ) -> None:
        """Execute a single job with lease renewal heartbeat and conditional completion."""
        logger.info(
            "Job [%s] (type=%s, attempt=%d/%d) claimed by [%s]",
            job_id,
            job_type,
            attempts,
            max_attempts,
            self.worker_id,
        )

        stop_heartbeat = asyncio.Event()
        ownership_lost = asyncio.Event()

        heartbeat_task = asyncio.create_task(
            self._lease_heartbeat_loop(job_id, stop_heartbeat, ownership_lost),
            name=f"heartbeat-{job_id}",
        )

        try:
            executor = get_executor(job_type)
            result = await executor(payload)

            stop_heartbeat.set()
            heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task

            if ownership_lost.is_set():
                logger.warning(
                    "Job [%s] (type=%s) finished locally, but ownership lost. Skipping update.",
                    job_id,
                    job_type,
                )
                return

            await self._mark_succeeded(job_id, result)
            logger.info("Job [%s] (type=%s) succeeded", job_id, job_type)

        except UnknownJobTypeError as e:
            stop_heartbeat.set()
            heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task

            logger.error("Job [%s] failed: %s", job_id, e)
            await self._mark_failed_or_retry(
                job_id=job_id,
                error_message=str(e),
                attempts=attempts,
                max_attempts=0,  # Do not retry unknown job types
                ownership_lost=ownership_lost,
            )

        except asyncio.CancelledError:
            stop_heartbeat.set()
            heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task

            if ownership_lost.is_set():
                logger.warning("Job [%s] execution cancelled due to lost lease.", job_id)
                return

            logger.info("Job [%s] execution cancelled during shutdown", job_id)
            # Release lease on shutdown cancellation so another worker can claim immediately
            await self._release_lease(job_id)
            raise

        except Exception as e:
            stop_heartbeat.set()
            heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat_task

            if ownership_lost.is_set():
                logger.warning(
                    "Job [%s] failed locally after lease was lost. Skipping update.",
                    job_id,
                )
                return

            logger.error(
                "Job [%s] (type=%s, attempt=%d/%d) failed with error: %s",
                job_id,
                job_type,
                attempts,
                max_attempts,
                e,
                exc_info=True,
            )
            await self._mark_failed_or_retry(
                job_id=job_id,
                error_message=str(e),
                attempts=attempts,
                max_attempts=max_attempts,
                ownership_lost=ownership_lost,
            )

    async def _lease_heartbeat_loop(
        self,
        job_id: uuid.UUID,
        stop_event: asyncio.Event,
        ownership_lost: asyncio.Event,
    ) -> None:
        """Periodically renew lease expiry while ensuring worker still owns the job."""
        while not stop_event.is_set():
            try:
                await asyncio.sleep(self.heartbeat_interval)
            except asyncio.CancelledError:
                break

            if stop_event.is_set():
                break

            try:
                async with self.session_factory() as session, session.begin():
                    now = datetime.now(UTC)
                    new_lease = now + timedelta(seconds=self.lease_duration)

                    stmt = (
                        update(AIJob)
                        .where(
                            AIJob.id == job_id,
                            AIJob.locked_by == self.worker_id,
                            AIJob.status == "running",
                        )
                        .values(
                            lease_expires_at=new_lease,
                            updated_at=now,
                        )
                    )
                    res = await session.execute(stmt)

                    if isinstance(res, CursorResult) and res.rowcount == 0:
                        logger.warning(
                            "Lease renewal for [%s] failed; lost to another worker. Stopping.",
                            job_id,
                        )
                        ownership_lost.set()
                        break
            except Exception as e:
                logger.warning("Error renewing lease for job [%s]: %s", job_id, e)

    async def _mark_succeeded(self, job_id: uuid.UUID, result: dict[str, Any] | None) -> None:
        """Conditionally mark job succeeded if worker still owns it."""
        async with self.session_factory() as session, session.begin():
            now = datetime.now(UTC)
            stmt = (
                update(AIJob)
                .where(
                    AIJob.id == job_id,
                    AIJob.locked_by == self.worker_id,
                    AIJob.status == "running",
                )
                .values(
                    status="succeeded",
                    result=result,
                    error_message=None,
                    locked_by=None,
                    lease_expires_at=None,
                    updated_at=now,
                )
            )
            await session.execute(stmt)

    async def _mark_failed_or_retry(
        self,
        job_id: uuid.UUID,
        error_message: str,
        attempts: int,
        max_attempts: int,
        ownership_lost: asyncio.Event,
    ) -> None:
        """Mark job failed or release back to pending for retry if attempts remain."""
        if ownership_lost.is_set():
            return

        async with self.session_factory() as session, session.begin():
            now = datetime.now(UTC)

            if attempts < max_attempts:
                # Retry: return to pending state and clear worker lock
                stmt = (
                    update(AIJob)
                    .where(
                        AIJob.id == job_id,
                        AIJob.locked_by == self.worker_id,
                        AIJob.status == "running",
                    )
                    .values(
                        status="pending",
                        error_message=error_message,
                        locked_by=None,
                        lease_expires_at=None,
                        updated_at=now,
                    )
                )
            else:
                # Max attempts reached: mark permanently failed
                stmt = (
                    update(AIJob)
                    .where(
                        AIJob.id == job_id,
                        AIJob.locked_by == self.worker_id,
                        AIJob.status == "running",
                    )
                    .values(
                        status="failed",
                        error_message=error_message,
                        locked_by=None,
                        lease_expires_at=None,
                        updated_at=now,
                    )
                )
            await session.execute(stmt)

    async def _release_lease(self, job_id: uuid.UUID) -> None:
        """Release worker lock and return job to pending state on graceful shutdown."""
        try:
            async with self.session_factory() as session, session.begin():
                now = datetime.now(UTC)
                stmt = (
                    update(AIJob)
                    .where(
                        AIJob.id == job_id,
                        AIJob.locked_by == self.worker_id,
                        AIJob.status == "running",
                    )
                    .values(
                        status="pending",
                        locked_by=None,
                        lease_expires_at=None,
                        updated_at=now,
                    )
                )
                await session.execute(stmt)
        except Exception as e:
            logger.warning("Failed to release lease for job [%s]: %s", job_id, e)


@asynccontextmanager
async def job_worker_lifespan(app: Any = None) -> AsyncGenerator[JobWorker, None]:
    """
    FastAPI lifespan context manager to start and stop the background worker.
    Usage:
        app = FastAPI(lifespan=job_worker_lifespan)
    """
    worker = JobWorker()
    await worker.start()
    try:
        yield worker
    finally:
        await worker.stop()


async def run_worker_cli() -> None:
    """Run worker as a standalone process with graceful SIGINT / SIGTERM handling."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    worker = JobWorker()
    await worker.start()

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, stop_event.set)

    logger.info("Background job worker process running. Press Ctrl+C to terminate.")
    try:
        await stop_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        await worker.stop()


if __name__ == "__main__":
    asyncio.run(run_worker_cli())

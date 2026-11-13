from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
import uuid
import pytest
from fastapi import HTTPException

from app.user.projects.refine_project.rate_limit import (
    SlidingWindowRateLimiter,
    RateLimitResult,
)


@pytest.mark.asyncio
async def test_sliding_window_allows_within_limit():
    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=10)

    # 1st request
    res1 = await limiter.check("user:1")
    assert res1.allowed is True
    assert res1.limit == 3
    assert res1.remaining == 2
    assert res1.retry_after == 0

    # 2nd request
    res2 = await limiter.check("user:1")
    assert res2.allowed is True
    assert res2.remaining == 1

    # 3rd request
    res3 = await limiter.check("user:1")
    assert res3.allowed is True
    assert res3.remaining == 0


@pytest.mark.asyncio
async def test_sliding_window_blocks_and_enforces_429():
    limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=5)

    # Consume capacity
    await limiter.enforce("user:2")
    await limiter.enforce("user:2")

    # 3rd request must raise HTTPException with 429
    with pytest.raises(HTTPException) as exc_info:
        await limiter.enforce("user:2")

    exc = exc_info.value
    assert exc.status_code == 429
    assert "Rate limit exceeded" in exc.detail
    assert "Retry-After" in exc.headers
    assert exc.headers["X-RateLimit-Limit"] == "2"
    assert exc.headers["X-RateLimit-Remaining"] == "0"
    assert int(exc.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_user_key_isolation():
    limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=10)

    # User A consumes limit
    res_a1 = await limiter.check("user:A")
    assert res_a1.allowed is True

    # User A is now blocked
    res_a2 = await limiter.check("user:A")
    assert res_a2.allowed is False

    # User B is unaffected
    res_b = await limiter.check("user:B")
    assert res_b.allowed is True
    assert res_b.remaining == 0


@pytest.mark.asyncio
async def test_sliding_window_reset():
    limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60)

    await limiter.enforce("user:reset_test")
    with pytest.raises(HTTPException):
        await limiter.enforce("user:reset_test")

    # Reset single key
    await limiter.reset("user:reset_test")
    res = await limiter.check("user:reset_test")
    assert res.allowed is True


@pytest.mark.asyncio
async def test_concurrent_requests_consistency():
    limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=10)

    async def hit():
        try:
            await limiter.enforce("user:concurrent")
            return True
        except HTTPException:
            return False

    # Dispatch 10 concurrent requests
    results = await asyncio.gather(*(hit() for _ in range(10)))
    assert results.count(True) == 5
    assert results.count(False) == 5


@pytest.mark.asyncio
async def test_request_pitch_refinement_enforces_rate_limit():
    from app.user.projects.refine_project.service import request_pitch_refinement

    # Mock user and pitch
    user_id = 99
    current_user = MagicMock()
    current_user.id = user_id

    pitch_id = uuid.uuid4()
    mock_pitch = MagicMock()
    mock_pitch.id = pitch_id
    mock_pitch.author_id = user_id
    mock_pitch.status = "draft"
    mock_pitch.title = "Test Pitch"
    mock_pitch.description = "Test Description"
    mock_pitch.problem = "Problem"
    mock_pitch.solution = "Solution"
    mock_pitch.target_audience = "Students"
    mock_pitch.technologies = ["FastAPI", "React"]

    # Mock AsyncSession
    db = AsyncMock()
    mock_result_pitch = MagicMock()
    mock_result_pitch.scalar_one_or_none.return_value = mock_pitch
    mock_result_jobs = MagicMock()
    mock_result_jobs.scalars.return_value.all.return_value = []

    # Sequence of db.execute calls: 1st fetches pitch, 2nd fetches existing jobs
    db.execute.side_effect = [
        mock_result_pitch,
        mock_result_jobs,
        mock_result_pitch,
        mock_result_jobs,
    ]

    # Limiter with limit 1
    limiter = SlidingWindowRateLimiter(max_requests=1, window_seconds=60)

    # First refinement enqueues fine (mock enqueue_job)
    with pytest.MonkeyPatch().context() as mp:
        mock_enqueue = AsyncMock()
        mock_job = MagicMock()
        mock_job.id = uuid.uuid4()
        mock_enqueue.return_value = mock_job
        mp.setattr("app.user.projects.refine_project.service.enqueue_job", mock_enqueue)

        res1 = await request_pitch_refinement(
            db=db,
            pitch_id=pitch_id,
            current_user=current_user,
            rate_limiter=limiter,
        )
        assert res1.job_id == mock_job.id

        # Second refinement request with different pitch content (new job needed) triggers rate limit
        mock_pitch.title = "Test Pitch Modified"
        with pytest.raises(HTTPException) as exc_info:
            await request_pitch_refinement(
                db=db,
                pitch_id=pitch_id,
                current_user=current_user,
                rate_limiter=limiter,
            )

        assert exc_info.value.status_code == 429
        assert "Retry-After" in exc_info.value.headers


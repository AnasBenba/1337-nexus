from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from math import ceil
from typing import NamedTuple

from fastapi import HTTPException, status


class RateLimitResult(NamedTuple):
    allowed: bool
    limit: int
    remaining: int
    retry_after: int
    reset_in: int


class SlidingWindowRateLimiter:
    """
    Asynchronous, thread-safe in-memory sliding window rate limiter.
    Does not introduce external dependencies or schema modifications.
    """

    def __init__(
        self,
        max_requests: int | None = None,
        window_seconds: int | None = None,
    ) -> None:
        self.max_requests = max_requests or int(
            os.getenv("PITCH_REFINE_RATE_LIMIT_REQUESTS", "5")
        )
        self.window_seconds = window_seconds or int(
            os.getenv("PITCH_REFINE_RATE_LIMIT_WINDOW", "60")
        )
        self._history: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> RateLimitResult:
        """
        Check if request for `key` is allowed under the sliding window.
        If allowed, records the current timestamp and returns remaining capacity.
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds

        async with self._lock:
            timestamps = self._history[key]

            # Evict timestamps older than the sliding window
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()

            count = len(timestamps)
            if count >= self.max_requests:
                oldest = timestamps[0]
                retry_after = max(1, ceil(oldest + self.window_seconds - now))
                return RateLimitResult(
                    allowed=False,
                    limit=self.max_requests,
                    remaining=0,
                    retry_after=retry_after,
                    reset_in=retry_after,
                )

            # Record this request
            timestamps.append(now)
            remaining = self.max_requests - (count + 1)
            oldest = timestamps[0]
            reset_in = max(1, ceil(oldest + self.window_seconds - now))

            return RateLimitResult(
                allowed=True,
                limit=self.max_requests,
                remaining=remaining,
                retry_after=0,
                reset_in=reset_in,
            )

    async def enforce(self, key: str, custom_message: str | None = None) -> RateLimitResult:
        """
        Enforce the rate limit. Raises HTTP 429 Too Many Requests if exceeded.
        """
        res = await self.check(key)
        if not res.allowed:
            detail = (
                custom_message
                or f"Rate limit exceeded: You can only submit up to {res.limit} pitch refinement requests every {self.window_seconds}s. Please retry in {res.retry_after}s."
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
                headers={
                    "Retry-After": str(res.retry_after),
                    "X-RateLimit-Limit": str(res.limit),
                    "X-RateLimit-Remaining": str(res.remaining),
                    "X-RateLimit-Reset": str(res.reset_in),
                },
            )
        return res

    async def reset(self, key: str | None = None) -> None:
        """Reset history for a key or all keys (useful for unit tests)."""
        async with self._lock:
            if key is None:
                self._history.clear()
            else:
                self._history.pop(key, None)


# Default singleton instance for pitch refiner LLM interface
pitch_refine_rate_limiter = SlidingWindowRateLimiter()

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger(__name__)

# An async executor receives the job's payload dictionary and returns an optional result dictionary
JobExecutor = Callable[[dict[str, Any]], Awaitable[dict[str, Any] | None]]


class UnknownJobTypeError(Exception):
    """Raised when looking up an unregistered job type."""

    def __init__(self, job_type: str) -> None:
        super().__init__(f"Unknown job type: '{job_type}'")
        self.job_type = job_type


_REGISTRY: dict[str, JobExecutor] = {}


def register(job_type: str) -> Callable[[JobExecutor], JobExecutor]:
    """Decorator to register an async executor function for a given job type."""

    def decorator(func: JobExecutor) -> JobExecutor:
        if job_type in _REGISTRY:
            logger.warning("Overwriting existing executor for job type '%s'", job_type)
        _REGISTRY[job_type] = func
        return func

    return decorator


def register_executor(job_type: str, executor: JobExecutor) -> None:
    """Explicitly register an async executor function for a given job type."""
    _REGISTRY[job_type] = executor


def get_executor(job_type: str) -> JobExecutor:
    """
    Retrieve the registered executor for a job type.
    Raises UnknownJobTypeError if not registered.
    """
    if job_type not in _REGISTRY:
        raise UnknownJobTypeError(job_type)
    return _REGISTRY[job_type]


def clear_registry() -> None:
    """Clear all registered job executors (useful for test isolation)."""
    _REGISTRY.clear()


# Built-in trivial executors for tests and verification
@register("echo")
async def echo_executor(payload: dict[str, Any]) -> dict[str, Any]:
    """Echoes back payload for testing without external services."""
    return {"echo": payload}


@register("noop")
async def noop_executor(payload: dict[str, Any]) -> dict[str, Any]:
    """No-op executor that succeeds immediately."""
    return {"status": "ok"}

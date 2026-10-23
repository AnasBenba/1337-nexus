from collections.abc import AsyncGenerator
from typing import Any, Protocol


class AIProvider(Protocol):
    async def stream_complete(
        self, messages: list[dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        ...

    async def stream_chat(
        self, messages: list[dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        ...

    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...

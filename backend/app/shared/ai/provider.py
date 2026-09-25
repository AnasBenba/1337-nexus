import asyncio
from collections.abc import AsyncGenerator
from typing import Protocol

class AIProvider(Protocol):
	async def stream_complete(self, messages: list[dict]) -> AsyncGenerator[str, None]:
		...
	async def embed(self, texts: list[str]) -> list[list[float]]:
		...

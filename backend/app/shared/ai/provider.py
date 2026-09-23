import asyncio
from typing import Protocol

class AIProvider(Protocol):
	async def stream_complete(self, messages: list[dict]) -> asyncio.AsyncGenerator[str, None]:
		...
	async def embed(self, texts: list[str]) -> list[list[float]]:
		...

import asyncio
import hashlib
import random
import re
from collections.abc import AsyncGenerator
from typing import Any

from .config import EMBEDDING_DIMENSIONS
from .provider import AIProvider


class stub(AIProvider):
    def __init__(self) -> None:
        self.response = "This is a stub response."

    async def stream_complete(
        self, messages: list[dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        for chunk in re.split(r"(\s+)", self.response):
            yield chunk
            await asyncio.sleep(0.05)

    stream_chat = stream_complete

    async def embed(self, texts: list[str]) -> list[list[float]]:
        embeddings = []
        for text in texts:
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            seed = int(digest[:16], 16)
            random.seed(seed)
            vector = [random.uniform(-1, 1) for _ in range(EMBEDDING_DIMENSIONS)]
            embeddings.append(vector)
        return embeddings

import os
from collections.abc import AsyncGenerator
from typing import Any

from google import genai

from .config import (
    AI_API_KEY,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    get_api_key,
)
from .provider import AIProvider


class GeminiAIProvider(AIProvider):
    """
    Google Gemini AI provider using official google-genai SDK.
    Generates 1536-dimensional embeddings and supports content streaming.
    """

    def __init__(
        self,
        api_key: str | None = None,
        embedding_model: str | None = None,
        client: genai.Client | None = None,
    ) -> None:
        self.api_key = api_key or get_api_key() or AI_API_KEY
        self.embedding_model = (
            embedding_model or os.getenv("EMBEDDING_MODEL") or EMBEDDING_MODEL
        )
        if client is not None:
            self.client = client
        else:
            self.client = genai.Client(api_key=self.api_key)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Generate dense embeddings for a batch of text chunks.
        Configures output_dimensionality=1536 to match Vector(1536) schema.

        Args:
            texts: List of string passages to embed.

        Returns:
            List of float vectors, each of length EMBEDDING_DIMENSIONS (1536).
        """
        if not texts:
            return []

        response = await self.client.aio.models.embed_content(
            model=self.embedding_model,
            contents=texts,
            config={"output_dimensionality": EMBEDDING_DIMENSIONS},
        )

        return [list(emb.values) for emb in response.embeddings]

    async def stream_complete(
        self, messages: list[dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completions for conversational agents using Gemini.
        Includes automatic retry for temporary 503 high-demand spikes.
        """
        import asyncio
        chat_model = os.getenv("CHAT_MODEL", "gemini-2.5-flash")
        contents = [msg.get("content", "") for msg in messages] if messages else [""]
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                response = await self.client.aio.models.generate_content_stream(
                    model=chat_model,
                    contents=contents,
                )
                async for chunk in response:
                    if chunk.text:
                        yield chunk.text
                return
            except Exception as e:
                err_str = str(e)
                if ("503" in err_str or "high demand" in err_str.lower()) and attempt < max_attempts - 1:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                raise

    stream_chat = stream_complete


# Alias for backward-compatibility with remote provider naming
RemoteAIProvider = GeminiAIProvider

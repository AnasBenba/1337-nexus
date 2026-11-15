import os
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from google import genai
from google.genai import types

from .config import (
    AI_API_KEY,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    get_api_key,
    get_api_keys,
)
from .provider import AIProvider

_FALLBACK_CHAT_MODELS = (
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
)


def _build_ipv4_http_options() -> types.HttpOptions:
    """Bind httpx transports to 0.0.0.0 so WSL2/Docker never hangs on dead IPv6 routes."""
    return types.HttpOptions(
        httpx_client=httpx.Client(
            transport=httpx.HTTPTransport(local_address="0.0.0.0"),
            timeout=30.0,
        ),
        httpx_async_client=httpx.AsyncClient(
            transport=httpx.AsyncHTTPTransport(local_address="0.0.0.0"),
            timeout=30.0,
        ),
    )


class GeminiAIProvider(AIProvider):
    """
    Google Gemini AI provider using official google-genai SDK.
    Generates 1536-dimensional embeddings and supports content streaming.
    Supports multi-key failover (GEMINI_API_KEY -> GEMINI_API_KEY1) and
    both Google AI Studio (AQ. / AIzaSy) and Vertex AI Express keys.
    """

    def __init__(
        self,
        api_key: str | None = None,
        embedding_model: str | None = None,
        client: genai.Client | None = None,
    ) -> None:
        resolved_keys = get_api_keys()
        if api_key:
            self.api_keys = [api_key] + [k for k in resolved_keys if k != api_key]
        elif resolved_keys:
            self.api_keys = resolved_keys
        elif AI_API_KEY:
            self.api_keys = [AI_API_KEY]
        else:
            self.api_keys = []

        self._key_index = 0
        self.api_key = api_key or get_api_key() or AI_API_KEY
        self.embedding_model = embedding_model or os.getenv("EMBEDDING_MODEL") or EMBEDDING_MODEL
        self._vertexai = os.getenv("GEMINI_VERTEXAI", "").lower() in ("1", "true", "yes")
        self._custom_client = client is not None
        if client is not None:
            self.client = client
        else:
            self.client = self._create_client(self.api_key, vertexai=self._vertexai)

    def _create_client(self, key: str | None, vertexai: bool = False) -> genai.Client:
        return genai.Client(
            api_key=key,
            vertexai=vertexai,
            http_options=_build_ipv4_http_options(),
        )

    def _switch_to_vertexai_if_needed(self, exc: Exception) -> bool:
        """
        Keys starting with 'AQ.' can come from either Google AI Studio (vertexai=False)
        or Google Cloud Vertex AI Express Mode (vertexai=True). If a Vertex AI Express
        key is used against the AI Studio endpoint, it fails with API_KEY_INVALID/401.
        Switch the client to vertexai=True automatically so both 'AQ.' key types work.
        """
        err_str = str(exc)
        if (
            not self._custom_client
            and not self._vertexai
            and self.api_key
            and self.api_key.startswith("AQ.")
            and (
                "API_KEY_INVALID" in err_str
                or "api key not valid" in err_str.lower()
                or "401" in err_str
            )
        ):
            self._vertexai = True
            self.client = self._create_client(self.api_key, vertexai=True)
            return True
        return False

    def _rotate_api_key_if_needed(self, exc: Exception) -> bool:
        """
        Fail over to the next configured API key (e.g. GEMINI_API_KEY1) on rate limit
        (429 / RESOURCE_EXHAUSTED) or key auth errors.
        """
        if self._custom_client or len(self.api_keys) <= 1:
            return False
        err_str = str(exc).lower()
        if any(
            token in err_str
            for token in (
                "429",
                "resource_exhausted",
                "quota",
                "rate limit",
                "api_key_invalid",
                "api key not valid",
                "401",
                "403",
                "permission_denied",
            )
        ):
            next_idx = self._key_index + 1
            if next_idx < len(self.api_keys):
                self._key_index = next_idx
                self.api_key = self.api_keys[self._key_index]
                self._vertexai = False
                self.client = self._create_client(self.api_key, vertexai=False)
                return True
        return False

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

        max_attempts = max(2, len(self.api_keys) + 1)
        for attempt in range(max_attempts):
            try:
                response = await self.client.aio.models.embed_content(
                    model=self.embedding_model,
                    contents=texts,
                    config={"output_dimensionality": EMBEDDING_DIMENSIONS},
                )
                return [list(emb.values) for emb in response.embeddings]
            except Exception as e:
                if self._switch_to_vertexai_if_needed(e) and attempt < max_attempts - 1:
                    continue
                if self._rotate_api_key_if_needed(e) and attempt < max_attempts - 1:
                    continue
                raise
        return []

    async def stream_complete(self, messages: list[dict[str, Any]]) -> AsyncGenerator[str, None]:
        """
        Stream chat completions for conversational agents using Gemini.
        Includes fast default model (gemini-3.5-flash-lite), automatic model fallback,
        multi-key failover (GEMINI_API_KEY -> GEMINI_API_KEY1), and 503 retry.
        """
        import asyncio

        configured_model = os.getenv("CHAT_MODEL", "gemini-3.5-flash-lite")
        model_candidates = [configured_model] + [
            m for m in _FALLBACK_CHAT_MODELS if m != configured_model
        ]
        model_idx = 0
        chat_model = model_candidates[model_idx]

        contents = [msg.get("content", "") for msg in messages] if messages else [""]
        max_attempts = 4
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
                if self._switch_to_vertexai_if_needed(e) and attempt < max_attempts - 1:
                    continue
                if self._rotate_api_key_if_needed(e) and attempt < max_attempts - 1:
                    continue
                if (
                    "404" in err_str
                    or "no longer available to new users" in err_str.lower()
                    or "not found" in err_str.lower()
                ) and model_idx + 1 < len(model_candidates):
                    model_idx += 1
                    chat_model = model_candidates[model_idx]
                    continue
                if (
                    "503" in err_str or "high demand" in err_str.lower()
                ) and attempt < max_attempts - 1:
                    if model_idx + 1 < len(model_candidates):
                        model_idx += 1
                        chat_model = model_candidates[model_idx]
                    else:
                        await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise

    stream_chat = stream_complete


# Alias for backward-compatibility with remote provider naming
RemoteAIProvider = GeminiAIProvider

"""Tests for GeminiAIProvider and AI provider client configuration."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.shared.ai.client import get_ai_provider
from app.shared.ai.config import (
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
)
from app.shared.ai.gemini import GeminiAIProvider
from app.shared.ai.stub import stub


class TestAIConfig:
    def test_default_config_values(self):
        assert EMBEDDING_MODEL == "gemini-embedding-001"
        assert EMBEDDING_DIMENSIONS == 1536


class TestAIClientFactory:
    def test_get_ai_provider_defaults_to_stub(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER", raising=False)
        provider = get_ai_provider()
        assert isinstance(provider, stub)

    def test_get_ai_provider_remote(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "remote")
        monkeypatch.setenv("GEMINI_API_KEY", "mock_gemini_key")
        provider = get_ai_provider()
        assert isinstance(provider, GeminiAIProvider)
        assert provider.api_key == "mock_gemini_key"

    def test_get_ai_provider_gemini_mode(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "gemini")
        monkeypatch.setenv("GEMINI_API_KEY", "mock_gemini_key")
        provider = get_ai_provider()
        assert isinstance(provider, GeminiAIProvider)

    def test_get_ai_provider_invalid_mode(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "unsupported_mode")
        with pytest.raises(ValueError, match="Unknown AI_PROVIDER mode"):
            get_ai_provider()


class TestGeminiAIProvider:
    @pytest.mark.asyncio
    async def test_embed_returns_1536_dim_vectors(self):
        mock_embedding_1 = MagicMock()
        mock_embedding_1.values = [0.1] * 1536

        mock_embedding_2 = MagicMock()
        mock_embedding_2.values = [-0.1] * 1536

        mock_response = MagicMock()
        mock_response.embeddings = [mock_embedding_1, mock_embedding_2]

        mock_client = MagicMock()
        mock_client.aio = MagicMock()
        mock_client.aio.models = MagicMock()
        mock_client.aio.models.embed_content = AsyncMock(return_value=mock_response)

        provider = GeminiAIProvider(
            api_key="test_key",
            embedding_model="gemini-embedding-001",
            client=mock_client,
        )

        texts = ["first text chunk", "second text chunk"]
        vectors = await provider.embed(texts)

        assert len(vectors) == 2
        assert len(vectors[0]) == 1536
        assert len(vectors[1]) == 1536
        assert vectors[0] == [0.1] * 1536

        mock_client.aio.models.embed_content.assert_awaited_once_with(
            model="gemini-embedding-001",
            contents=texts,
            config={"output_dimensionality": 1536},
        )

    @pytest.mark.asyncio
    async def test_embed_empty_list_returns_empty(self):
        mock_client = MagicMock()
        mock_client.aio = MagicMock()
        mock_client.aio.models = MagicMock()
        mock_client.aio.models.embed_content = AsyncMock()
        provider = GeminiAIProvider(client=mock_client)

        vectors = await provider.embed([])
        assert vectors == []
        mock_client.aio.models.embed_content.assert_not_called()

    @pytest.mark.asyncio
    async def test_token_resolution_hierarchy(self, monkeypatch):
        # 1. GOOGLE_API_KEY fallback
        monkeypatch.setenv("GOOGLE_API_KEY", "google_fallback_key")
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        monkeypatch.delenv("GEMINI_API_KEY1", raising=False)
        p1 = GeminiAIProvider(client=MagicMock())
        assert p1.api_key == "google_fallback_key"

        # 2. GEMINI_API_KEY1 overrides GOOGLE_API_KEY
        monkeypatch.setenv("GEMINI_API_KEY1", "gemini_backup_key")
        p_backup = GeminiAIProvider(client=MagicMock())
        assert p_backup.api_key == "gemini_backup_key"

        # 3. GEMINI_API_KEY overrides GEMINI_API_KEY1 and GOOGLE_API_KEY
        monkeypatch.setenv("GEMINI_API_KEY", "gemini_primary_key")
        p2 = GeminiAIProvider(client=MagicMock())
        assert p2.api_key == "gemini_primary_key"
        assert p2.api_keys == ["gemini_primary_key", "gemini_backup_key", "google_fallback_key"]

    @pytest.mark.asyncio
    async def test_stream_complete_defaults_to_gemini_3_5_flash_lite_and_falls_back_on_deprecated_model(
        self, monkeypatch
    ):
        monkeypatch.setenv("CHAT_MODEL", "gemini-2.5-flash")

        chunk = MagicMock()
        chunk.text = "Critique response"

        async def _mock_stream():
            yield chunk

        call_models: list[str] = []

        async def _side_effect(model: str, contents):
            call_models.append(model)
            if model == "gemini-2.5-flash":
                raise RuntimeError(
                    "404 NOT_FOUND: This model models/gemini-2.5-flash is no longer available to new users."
                )
            return _mock_stream()

        mock_client = MagicMock()
        mock_client.aio = MagicMock()
        mock_client.aio.models = MagicMock()
        mock_client.aio.models.generate_content_stream = AsyncMock(side_effect=_side_effect)

        provider = GeminiAIProvider(api_key="AQ.Ab8_test_key", client=mock_client)
        tokens = [
            t async for t in provider.stream_complete([{"role": "user", "content": "Hello"}])
        ]

        assert tokens == ["Critique response"]
        assert call_models == ["gemini-2.5-flash", "gemini-3.5-flash-lite"]

    @pytest.mark.asyncio
    async def test_aq_key_switches_to_vertexai_on_api_key_invalid(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        monkeypatch.delenv("GEMINI_API_KEY1", raising=False)
        monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

        mock_embedding = MagicMock()
        mock_embedding.values = [0.5] * 1536
        mock_response = MagicMock()
        mock_response.embeddings = [mock_embedding]

        first_client = MagicMock()
        first_client.aio.models.embed_content = AsyncMock(
            side_effect=RuntimeError("400 INVALID_ARGUMENT: API_KEY_INVALID - API key not valid")
        )

        second_client = MagicMock()
        second_client.aio.models.embed_content = AsyncMock(return_value=mock_response)

        monkeypatch.setattr(
            "app.shared.ai.gemini.genai.Client",
            lambda **kwargs: second_client if kwargs.get("vertexai") else first_client,
        )

        provider = GeminiAIProvider(api_key="AQ.Ab8_vertex_express_key")
        vectors = await provider.embed(["test text"])

        assert provider._vertexai is True
        assert len(vectors) == 1
        assert len(vectors[0]) == 1536

    @pytest.mark.asyncio
    async def test_multi_key_failover_to_gemini_api_key1_on_rate_limit(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "AQ.primary_rate_limited_key")
        monkeypatch.setenv("GEMINI_API_KEY1", "AIzaSy_backup_old_key")
        monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

        mock_embedding = MagicMock()
        mock_embedding.values = [0.25] * 1536
        mock_response = MagicMock()
        mock_response.embeddings = [mock_embedding]

        primary_client = MagicMock()
        primary_client.aio.models.embed_content = AsyncMock(
            side_effect=RuntimeError("429 RESOURCE_EXHAUSTED: Quota exceeded")
        )

        backup_client = MagicMock()
        backup_client.aio.models.embed_content = AsyncMock(return_value=mock_response)

        created_keys: list[str | None] = []

        def _fake_client(**kwargs):
            created_keys.append(kwargs.get("api_key"))
            return primary_client if kwargs.get("api_key") == "AQ.primary_rate_limited_key" else backup_client

        monkeypatch.setattr("app.shared.ai.gemini.genai.Client", _fake_client)

        provider = GeminiAIProvider()
        vectors = await provider.embed(["inception service of choice"])

        assert provider.api_key == "AIzaSy_backup_old_key"
        assert created_keys == ["AQ.primary_rate_limited_key", "AIzaSy_backup_old_key"]
        assert len(vectors) == 1
        assert len(vectors[0]) == 1536

"""
Tests for retrieve_curriculum module: schemas, service, and HTTP router.
"""
import uuid
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.db import get_db_session
from app.shared.ai.client import get_ai_provider
from app.shared.ai.stub import stub
from app.user.copilot.retrieve_curriculum.router import router
from app.user.copilot.retrieve_curriculum.schemas import (
    ChunkResult,
    RetrievalQuery,
    RetrievalResult,
)
from app.user.copilot.retrieve_curriculum.service import retrieve_curriculum


class TestSchemas:
    def test_valid_retrieval_query(self) -> None:
        q = RetrievalQuery(query="how to sort numbers in push_swap", k=3)
        assert q.query == "how to sort numbers in push_swap"
        assert q.k == 3

    def test_default_k(self) -> None:
        q = RetrievalQuery(query="hello")
        assert q.k == 5

    def test_query_validation(self) -> None:
        with pytest.raises(ValidationError):
            RetrievalQuery(query="")
        with pytest.raises(ValidationError):
            RetrievalQuery(query="hello", k=0)
        with pytest.raises(ValidationError):
            RetrievalQuery(query="hello", k=25)

    def test_chunk_result_has_metadata(self) -> None:
        chunk = ChunkResult(
            chunk_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            subject_slug="push_swap",
            ordinal=1,
            snippet="Radix sort implementation",
            chunk_metadata={"header 1": "Mandatory Part"},
            distance=0.12,
        )
        assert chunk.chunk_metadata == {"header 1": "Mandatory Part"}


class TestService:
    @pytest.mark.asyncio
    async def test_retrieve_curriculum_service_success(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake_chunk_id = uuid.uuid4()
        fake_doc_id = uuid.uuid4()
        fake_metadata: dict[str, Any] = {"header 1": "Mandatory Part"}
        mock_rows = [
            {
                "chunk_id": fake_chunk_id,
                "document_id": fake_doc_id,
                "subject_slug": "push_swap",
                "ordinal": 1,
                "snippet": "Radix sort implementation",
                "chunk_metadata": fake_metadata,
                "distance": 0.1234,
            }
        ]

        mock_find = AsyncMock(return_value=mock_rows)
        monkeypatch.setattr(
            "app.user.copilot.retrieve_curriculum.service.find_nearest_chunks",
            mock_find,
        )

        ai = stub()
        mock_db = AsyncMock()

        query = RetrievalQuery(query="how does push_swap work?", k=1)
        res = await retrieve_curriculum(query, mock_db, ai)

        assert isinstance(res, RetrievalResult)
        assert res.query == "how does push_swap work?"
        assert len(res.chunks) == 1
        assert res.chunks[0].chunk_id == fake_chunk_id
        assert res.chunks[0].subject_slug == "push_swap"
        assert res.chunks[0].chunk_metadata == fake_metadata
        assert res.chunks[0].distance == pytest.approx(0.1234, rel=1e-3)
        mock_find.assert_awaited_once()


class TestRouter:
    def test_endpoint_with_test_client(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        test_app = FastAPI()
        test_app.include_router(router)

        # Bulletproof dependency overrides for CI environments
        test_app.dependency_overrides[get_db_session] = lambda: AsyncMock()
        test_app.dependency_overrides[get_ai_provider] = lambda: AsyncMock()

        fake_result = RetrievalResult(
            query="test query",
            chunks=[
                ChunkResult(
                    chunk_id=uuid.uuid4(),
                    document_id=uuid.uuid4(),
                    subject_slug="libft",
                    ordinal=0,
                    snippet="Libft string functions",
                    chunk_metadata={"header 1": "Overview"},
                    distance=0.05,
                )
            ],
        )

        mock_service = AsyncMock(return_value=fake_result)
        monkeypatch.setattr(
            "app.user.copilot.retrieve_curriculum.router.retrieve_curriculum",
            mock_service,
        )

        client = TestClient(test_app)
        response = client.post(
            "/api/v1/copilot/retrieve-curriculum",
            json={"query": "test query", "k": 1},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "test query"
        assert len(data["chunks"]) == 1
        assert data["chunks"][0]["subject_slug"] == "libft"
        assert data["chunks"][0]["chunk_metadata"] == {"header 1": "Overview"}
        assert data["chunks"][0]["distance"] == 0.05

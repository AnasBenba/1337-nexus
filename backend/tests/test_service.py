"""
Unit tests for Copilot Ask Service (Phase 1: Pre-Stream Transaction & Retrieval).
Aligned with schema: Table copilot_threads & Table copilot_messages.
"""
import uuid
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.copilot import CopilotMessage, CopilotThread
from app.shared.ai.stub import stub
from app.user.copilot.ask.schemas import AskRequest, PreStreamResult
from app.user.copilot.ask.service import (
    format_sse,
    pre_stream_transaction,
    prepare_copilot_stream,
    stream_copilot_answer,
)
from app.user.copilot.retrieve_curriculum.schemas import (
    ChunkResult,
    RetrievalResult,
)


class MockAsyncSession:
    """Mock async database session tracking added models and transactions."""

    def __init__(self) -> None:
        self.added: list[Any] = []
        self.commit_called = False
        self.rollback_called = False
        self.closed = False
        self._registry: dict[tuple[type, Any], Any] = {}

    def add(self, instance: Any) -> None:
        self.added.append(instance)
        if hasattr(instance, "id"):
            self._registry[(type(instance), instance.id)] = instance

    async def get(self, entity_cls: type, ident: Any) -> Any:
        return self._registry.get((entity_cls, ident))

    async def commit(self) -> None:
        self.commit_called = True

    async def rollback(self) -> None:
        self.rollback_called = True

    async def close(self) -> None:
        self.closed = True

    async def __aenter__(self) -> "MockAsyncSession":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> bool:
        if exc_type is not None:
            await self.rollback()
        await self.close()
        return False


def _create_fake_chunks(count: int = 2) -> list[ChunkResult]:
    return [
        ChunkResult(
            chunk_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            subject_slug="push_swap",
            ordinal=i,
            snippet=f"Snippet content {i}",
            chunk_metadata={"section": f"part_{i}"},
            distance=0.05 * (i + 1),
        )
        for i in range(count)
    ]


class TestPreStreamTransaction:
    @pytest.mark.asyncio
    async def test_pre_stream_transaction_success(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Verify Phase 1:
        1. Opens short session
        2. Creates/ensures parent copilot_threads row
        3. Calls retrieve_curriculum
        4. Inserts user message
        5. Inserts assistant placeholder with serialized context_chunks
        6. Commits and exits session immediately
        """
        fake_chunks = _create_fake_chunks(2)
        mock_retrieval_result = RetrievalResult(
            query="how does push_swap work?",
            chunks=fake_chunks,
        )

        mock_retrieve = AsyncMock(return_value=mock_retrieval_result)
        monkeypatch.setattr(
            "app.user.copilot.ask.service.retrieve_curriculum",
            mock_retrieve,
        )

        session = MockAsyncSession()
        mock_factory = MagicMock(return_value=session)
        ai = stub()

        body = AskRequest(question="how does push_swap work?", k=2)
        result = await pre_stream_transaction(
            body=body,
            ai=ai,
            async_session_factory=mock_factory,
        )

        # 1. Session factory was invoked
        mock_factory.assert_called_once()

        # 2. retrieve_curriculum was called with correct parameters
        mock_retrieve.assert_awaited_once()
        retrieval_query_arg = mock_retrieve.await_args.args[0]
        assert retrieval_query_arg.query == "how does push_swap work?"
        assert retrieval_query_arg.k == 2

        # 3. Thread, user message, and assistant placeholder inserted
        assert len(session.added) == 3
        thread, user_msg, assistant_msg = session.added

        assert isinstance(thread, CopilotThread)
        assert thread.id == result.thread_id

        assert isinstance(user_msg, CopilotMessage)
        assert user_msg.role == "user"
        assert user_msg.content == "how does push_swap work?"
        assert user_msg.status == "completed"
        assert user_msg.thread_id == thread.id

        assert isinstance(assistant_msg, CopilotMessage)
        assert assistant_msg.role == "assistant"
        assert assistant_msg.content == ""
        assert assistant_msg.status == "streaming"
        assert assistant_msg.thread_id == thread.id
        assert assistant_msg.context_chunks is not None
        assert len(assistant_msg.context_chunks) == 2
        assert assistant_msg.context_chunks[0]["snippet"] == "Snippet content 0"
        assert assistant_msg.context_chunks[0]["chunk_id"] == str(fake_chunks[0].chunk_id)

        # 4. Committed and closed
        assert session.commit_called is True
        assert session.closed is True

        # 5. Returned DTO is populated
        assert isinstance(result, PreStreamResult)
        assert result.thread_id == thread.id
        assert result.conversation_id == thread.id  # alias
        assert result.user_message.id == user_msg.id
        assert result.assistant_message.id == assistant_msg.id
        assert result.context_chunks == fake_chunks

    @pytest.mark.asyncio
    async def test_pre_stream_transaction_preserves_thread_and_user_ids(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_retrieval_result = RetrievalResult(
            query="test query",
            chunks=[],
        )
        monkeypatch.setattr(
            "app.user.copilot.ask.service.retrieve_curriculum",
            AsyncMock(return_value=mock_retrieval_result),
        )

        session = MockAsyncSession()
        mock_factory = MagicMock(return_value=session)
        ai = stub()

        test_thread_id = uuid.uuid4()
        user_id = uuid.uuid4()
        project_id = uuid.uuid4()
        body = AskRequest(
            question="test query",
            k=3,
            thread_id=test_thread_id,
            user_id=user_id,
            project_id=project_id,
            subject_slug="push_swap",
        )

        result = await pre_stream_transaction(
            body=body,
            ai=ai,
            async_session_factory=mock_factory,
        )

        assert result.thread_id == test_thread_id
        thread, user_msg, assistant_msg = session.added
        assert thread.id == test_thread_id
        assert thread.user_id == user_id
        assert thread.project_id == project_id
        assert thread.subject_slug == "push_swap"
        assert user_msg.thread_id == test_thread_id
        assert assistant_msg.thread_id == test_thread_id

    @pytest.mark.asyncio
    async def test_pre_stream_transaction_rolls_back_on_retrieval_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        mock_retrieve = AsyncMock(side_effect=RuntimeError("Vector DB unavailable"))
        monkeypatch.setattr(
            "app.user.copilot.ask.service.retrieve_curriculum",
            mock_retrieve,
        )

        session = MockAsyncSession()
        mock_factory = MagicMock(return_value=session)
        ai = stub()

        body = AskRequest(question="Will fail", k=1)
        with pytest.raises(RuntimeError, match="Vector DB unavailable"):
            await pre_stream_transaction(
                body=body,
                ai=ai,
                async_session_factory=mock_factory,
            )

        assert session.commit_called is False
        assert session.rollback_called is True
        assert session.closed is True

    def test_alias_exports(self) -> None:
        assert prepare_copilot_stream is pre_stream_transaction

class TestFormatSSE:
    def test_format_sse_structure(self) -> None:
        import json
        frame = format_sse("delta", {"content": "Hello"})
        assert frame.startswith("event: delta\n")
        assert "data: " in frame
        assert frame.endswith("\n\n")
        payload = json.loads(frame.split("data: ", 1)[1].strip())
        assert payload["content"] == "Hello"

    def test_format_sse_meta(self) -> None:
        import json
        frame = format_sse("meta", {"thread_id": "abc", "citations": []})
        payload = json.loads(frame.split("data: ", 1)[1].strip())
        assert payload["thread_id"] == "abc"
        assert payload["citations"] == []


class TestStreamCopilotAnswer:
    @pytest.mark.asyncio
    async def test_yields_meta_then_deltas_then_done(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Full integration test for the Phase 2+3 generator:
        checks SSE event ordering, meta payload, delta tokens, and done frame.
        """
        import json

        fake_chunks = _create_fake_chunks(1)
        monkeypatch.setattr(
            "app.user.copilot.ask.service.retrieve_curriculum",
            AsyncMock(
                return_value=RetrievalResult(query="test", chunks=fake_chunks)
            ),
        )

        # Fake AI provider that yields two tokens
        async def fake_stream(messages: list) -> AsyncGenerator[str, None]:
            for word in ["Hello", " world"]:
                yield word

        class FakeAI:
            async def embed(self, texts: list) -> list:
                return [[0.0] * 5]

            def stream_complete(self, messages: list) -> AsyncGenerator[str, None]:
                return fake_stream(messages)

        session = MockAsyncSession()
        mock_factory = MagicMock(return_value=session)

        body = AskRequest(question="What is push_swap?", k=1)

        frames: list[str] = []
        async for frame in stream_copilot_answer(
            body=body, ai=FakeAI(), async_session_factory=mock_factory
        ):
            frames.append(frame)

        # Parse event types in order
        events = []
        for frame in frames:
            event_line = [l for l in frame.splitlines() if l.startswith("event:")][0]
            data_line = [l for l in frame.splitlines() if l.startswith("data:")][0]
            event_type = event_line.split("event: ", 1)[1]
            data = json.loads(data_line.split("data: ", 1)[1])
            events.append((event_type, data))

        assert events[0][0] == "meta"
        assert "thread_id" in events[0][1]
        assert "message_id" in events[0][1]
        assert "citations" in events[0][1]

        delta_events = [e for e in events if e[0] == "delta"]
        assert len(delta_events) == 2
        assert delta_events[0][1]["content"] == "Hello"
        assert delta_events[1][1]["content"] == " world"

        assert events[-1][0] == "done"
        assert events[-1][1]["status"] == "completed"
        assert "tokens" in events[-1][1]

    @pytest.mark.asyncio
    async def test_done_status_failed_on_stream_exception(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import json

        monkeypatch.setattr(
            "app.user.copilot.ask.service.retrieve_curriculum",
            AsyncMock(
                return_value=RetrievalResult(query="fail", chunks=[])
            ),
        )

        async def failing_stream(messages: list) -> AsyncGenerator[str, None]:
            raise RuntimeError("LLM exploded")
            yield  # make it a generator

        class BadAI:
            async def embed(self, texts: list) -> list:
                return [[0.0] * 5]

            def stream_complete(self, messages: list) -> AsyncGenerator[str, None]:
                return failing_stream(messages)

        session = MockAsyncSession()
        mock_factory = MagicMock(return_value=session)

        body = AskRequest(question="Should fail", k=1)

        frames: list[str] = []
        async for frame in stream_copilot_answer(
            body=body, ai=BadAI(), async_session_factory=mock_factory
        ):
            frames.append(frame)

        done_frame = [f for f in frames if "event: done" in f][-1]
        data_line = [l for l in done_frame.splitlines() if l.startswith("data:")][0]
        done_data = json.loads(data_line.split("data: ", 1)[1])
        assert done_data["status"] == "failed"


class TestAskRouter:
    @pytest.mark.asyncio
    async def test_ask_endpoint_sse_headers_and_stream(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Integration test for POST /api/v1/copilot/ask endpoint:
        - Validates HTTP 200
        - Validates Content-Type: text/event-stream
        - Validates anti-buffering headers (Cache-Control, Connection, X-Accel-Buffering)
        - Parses SSE chunks (meta -> delta -> done)
        """
        import json
        from fastapi import FastAPI
        from httpx import ASGITransport, AsyncClient
        from app.user.copilot.ask.router import router as ask_router
        from app.shared.ai.client import get_ai_provider

        app = FastAPI()
        app.include_router(ask_router)

        fake_chunks = _create_fake_chunks(1)
        monkeypatch.setattr(
            "app.user.copilot.ask.service.retrieve_curriculum",
            AsyncMock(
                return_value=RetrievalResult(query="test", chunks=fake_chunks)
            ),
        )

        class StubStreamAI:
            async def embed(self, texts: list) -> list:
                return [[0.0] * 5]

            async def stream_chat(self, messages: list) -> AsyncGenerator[str, None]:
                yield "Push_swap "
                yield "tutorial."

        session = MockAsyncSession()
        mock_factory = MagicMock(return_value=session)
        monkeypatch.setattr("app.user.copilot.ask.service.SessionLocal", mock_factory)

        app.dependency_overrides[get_ai_provider] = lambda: StubStreamAI()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/copilot/ask",
                json={"question": "How does push_swap work?", "k": 3},
            )

            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            assert response.headers.get("cache-control") == "no-cache"
            assert response.headers.get("connection") == "keep-alive"
            assert response.headers.get("x-accel-buffering") == "no"

            body_text = response.text
            assert "event: meta" in body_text
            assert "event: delta" in body_text
            assert "event: done" in body_text
            assert "Push_swap " in body_text
            assert "completed" in body_text

    @pytest.mark.asyncio
    async def test_ask_endpoint_with_stub_provider(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """
        Validate POST /api/v1/copilot/ask with the standard stub() provider:
        Ensures CI tests run deterministically and fast without live Gemini API.
        """
        from fastapi import FastAPI
        from httpx import ASGITransport, AsyncClient
        from app.user.copilot.ask.router import router as ask_router
        from app.shared.ai.client import get_ai_provider
        from app.shared.ai.stub import stub

        app = FastAPI()
        app.include_router(ask_router)

        fake_chunks = _create_fake_chunks(2)
        monkeypatch.setattr(
            "app.user.copilot.ask.service.retrieve_curriculum",
            AsyncMock(
                return_value=RetrievalResult(query="stub question", chunks=fake_chunks)
            ),
        )

        session = MockAsyncSession()
        mock_factory = MagicMock(return_value=session)
        monkeypatch.setattr("app.user.copilot.ask.service.SessionLocal", mock_factory)

        # Wire deterministic stub provider
        app.dependency_overrides[get_ai_provider] = lambda: stub()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/copilot/ask",
                json={"question": "Tell me about libft", "k": 2},
            )

            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            body = response.text
            assert "event: meta" in body
            assert "event: delta" in body
            assert "event: done" in body
            assert "This is a stub response." in body.replace("event: delta\ndata: {\"content\": \"", "").replace("\"}\n\n", "")
            assert '"status": "completed"' in body

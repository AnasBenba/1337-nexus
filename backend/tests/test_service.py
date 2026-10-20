"""
Unit tests for Copilot Ask Service (Phase 1: Pre-Stream Transaction & Retrieval).
Aligned with schema: Table copilot_threads & Table copilot_messages.
"""
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.copilot import CopilotMessage, CopilotThread
from app.shared.ai.stub import stub
from app.user.copilot.ask.schemas import AskRequest, PreStreamResult
from app.user.copilot.ask.service import (
    pre_stream_transaction,
    prepare_copilot_stream,
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

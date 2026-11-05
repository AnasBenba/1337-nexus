from __future__ import annotations

import json
import os
import uuid
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://nexus_migrator:nexus_migrator_password@localhost:5433/nexus",
)
os.environ.setdefault(
    "MIGRATION_DATABASE_URL",
    "postgresql+asyncpg://nexus_migrator:nexus_migrator_password@localhost:5433/nexus",
)
os.environ.setdefault("TRUSTED_PROXY_SUBNET", "172.28.0.0/24")

from app.models.job import AIJob
from app.models.suggestion import PitchCritique, PitchSuggestion
from app.oauth.user import Users
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCategory, PitchStatus
from app.user.projects.refine_project.executor import refine_pitch_executor
from app.user.projects.refine_project.service import (
    apply_pitch_suggestion,
    compute_pitch_hash,
    dismiss_pitch_suggestion,
    get_pitch_refine_status,
    request_pitch_refinement,
)

TEST_DB_URL = os.environ["DATABASE_URL"]


@pytest_asyncio.fixture(scope="function")
async def test_engine() -> AsyncEngine:
    engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
def session_factory(test_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest_asyncio.fixture(autouse=True)
async def cleanup_db(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Clean up test tables before and after each test."""
    async with session_factory() as session, session.begin():
        await session.execute(delete(PitchSuggestion))
        await session.execute(delete(PitchCritique))
        await session.execute(delete(AIJob))
        await session.execute(delete(Pitch))
        await session.execute(delete(Users))
    yield
    async with session_factory() as session, session.begin():
        await session.execute(delete(PitchSuggestion))
        await session.execute(delete(PitchCritique))
        await session.execute(delete(AIJob))
        await session.execute(delete(Pitch))
        await session.execute(delete(Users))


@pytest.fixture
def mock_ai_provider():
    with (
        patch("app.user.projects.refine_project.service.get_ai_provider") as mock_get_srv,
        patch("app.user.projects.refine_project.executor.get_ai_provider") as mock_get_exec,
        patch("app.user.pitches.service.get_ai_provider") as mock_get_pitch,
    ):
        ai_mock = AsyncMock()
        ai_mock.embed.return_value = [[0.1] * 1536]
        mock_get_srv.return_value = ai_mock
        mock_get_exec.return_value = ai_mock
        mock_get_pitch.return_value = ai_mock
        yield ai_mock


async def create_test_user(session: AsyncSession, user_id: int, role: str = "user") -> Users:
    user = Users(
        id=user_id,
        login=f"user_{user_id}",
        fullname=f"User {user_id}",
        role=role,
        intra_id=1000 + user_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def create_test_pitch(
    session: AsyncSession,
    author_id: int,
    title: str = "Initial Pitch Title",
    description: str | None = "A great project connecting students to mentors.",
    content: str = (
        "Problem: Finding mentors is difficult.\n"
        "Solution: A peer network with AI matching.\n"
        "Impact: 500 active mentors in year one."
    ),
    status: PitchStatus = PitchStatus.DRAFT,
) -> Pitch:
    pitch = Pitch(
        id=uuid.uuid4(),
        title=title,
        description=description,
        content=content,
        category=PitchCategory.TECH,
        status=status,
        author_id=author_id,
    )
    session.add(pitch)
    await session.commit()
    await session.refresh(pitch)
    return pitch


@pytest.mark.asyncio
async def test_authorization_rules(
    session_factory: async_sessionmaker[AsyncSession],
    mock_ai_provider: Any,
) -> None:
    async with session_factory() as session:
        author = await create_test_user(session, user_id=1, role="user")
        admin = await create_test_user(session, user_id=2, role="admin")
        stranger = await create_test_user(session, user_id=3, role="user")

        pitch = await create_test_pitch(session, author_id=author.id)

        # Stranger -> 403
        with pytest.raises(HTTPException) as exc_info:
            await request_pitch_refinement(session, pitch.id, stranger)
        assert exc_info.value.status_code == 403

        # Author -> 200 Queued
        res_author = await request_pitch_refinement(session, pitch.id, author)
        assert res_author.status == "queued"

        # Admin -> idempotent response (job already running/queued)
        res_admin = await request_pitch_refinement(session, pitch.id, admin)
        assert res_admin.job_id == res_author.job_id


@pytest.mark.asyncio
async def test_draft_only_and_empty_content_guards(
    session_factory: async_sessionmaker[AsyncSession],
    mock_ai_provider: Any,
) -> None:
    async with session_factory() as session:
        author = await create_test_user(session, user_id=10, role="user")
        published_pitch = await create_test_pitch(
            session, author_id=author.id, status=PitchStatus.PUBLISHED
        )

        with pytest.raises(HTTPException) as exc_info:
            await request_pitch_refinement(session, published_pitch.id, author)
        assert exc_info.value.status_code == 400
        assert "Only draft pitches" in exc_info.value.detail

        empty_pitch = await create_test_pitch(session, author_id=author.id, content="   ")
        with pytest.raises(HTTPException) as exc_info2:
            await request_pitch_refinement(session, empty_pitch.id, author)
        assert exc_info2.value.status_code == 400
        assert "cannot be empty" in exc_info2.value.detail


@pytest.mark.asyncio
async def test_idempotent_enqueue_and_snapshot(
    session_factory: async_sessionmaker[AsyncSession],
    mock_ai_provider: Any,
) -> None:
    async with session_factory() as session:
        author = await create_test_user(session, user_id=20, role="user")
        pitch = await create_test_pitch(session, author_id=author.id)

        res1 = await request_pitch_refinement(session, pitch.id, author)
        res2 = await request_pitch_refinement(session, pitch.id, author)
        assert res1.job_id == res2.job_id

        # Verify job in DB
        job = (await session.execute(select(AIJob).where(AIJob.id == res1.job_id))).scalar_one()
        assert job.status in ("pending", "queued")
        payload = job.payload
        assert payload["pitch_id"] == str(pitch.id)
        assert payload["title"] == pitch.title
        assert payload["content"] == pitch.content
        expected_hash = compute_pitch_hash(pitch.title, pitch.description, pitch.content)
        assert payload["base_hash"] == expected_hash


@pytest.mark.asyncio
async def test_executor_critique_parsing_and_excerpt_validation(
    session_factory: async_sessionmaker[AsyncSession],
    mock_ai_provider: Any,
) -> None:
    async with session_factory() as session:
        author = await create_test_user(session, user_id=30, role="user")
        pitch = await create_test_pitch(
            session,
            author_id=author.id,
            title="AI Study Buddy",
            description="Personalized tutor for coding students.",
            content="We help students learn Python through interactive challenges.",
        )

        res = await request_pitch_refinement(session, pitch.id, author)
        job = (await session.execute(select(AIJob).where(AIJob.id == res.job_id))).scalar_one()

        llm_critique_json = {
            "executive_assessment": (
                "Solid pitch with clear intent but needs more concrete metrics."
            ),
            "strengths": [
                "Clear target audience",
                "Concise value proposition",
                "Actionable scope",
            ],
            "suggestions": [
                {
                    "field": "title",
                    "section_label": "Title",
                    "severity": "minor",
                    "title": "Sharpen the title",
                    "original_excerpt": "AI Study Buddy",
                    "suggested_text": "NexusAI: Interactive Python Study Companion",
                    "rationale": "More distinctive and descriptive branding.",
                },
                {
                    "field": "content",
                    "section_label": "Value Proposition",
                    "severity": "critical",
                    "title": "Quantify student outcomes",
                    "original_excerpt": (
                        "We help students learn Python through interactive challenges."
                    ),
                    "suggested_text": (
                        "We help students master Python in 30 days "
                        "through 100+ interactive challenges."
                    ),
                    "rationale": "Adds specific measurable timeframe and outcomes.",
                },
                {
                    "field": "content",
                    "section_label": "Hallucinated Suggestion",
                    "severity": "major",
                    "title": "This excerpt does not exist",
                    "original_excerpt": "This exact sentence is NOT in the pitch content at all.",
                    "suggested_text": "Hallucinated replacement.",
                    "rationale": "Should be filtered out by executor validation.",
                },
            ],
        }

        async def fake_stream(messages: Any):
            yield json.dumps(llm_critique_json)

        mock_ai_provider.stream_complete.side_effect = fake_stream

        # Run executor
        payload = dict(job.payload)
        payload["job_id"] = str(job.id)
        await refine_pitch_executor(payload, session=session)

        # Verify critique persisted
        critique = (
            await session.execute(select(PitchCritique).where(PitchCritique.job_id == job.id))
        ).scalar_one()
        assert critique.summary == "Solid pitch with clear intent but needs more concrete metrics."
        assert len(critique.strengths) == 3

        # Verify suggestions: valid ones kept, hallucinated one dropped
        suggestions = (
            (
                await session.execute(
                    select(PitchSuggestion).where(PitchSuggestion.critique_id == critique.id)
                )
            )
            .scalars()
            .all()
        )
        assert len(suggestions) == 2
        titles = [s.title for s in suggestions]
        assert "Sharpen the title" in titles
        assert "Quantify student outcomes" in titles
        assert "This excerpt does not exist" not in titles


@pytest.mark.asyncio
async def test_apply_suggestion_and_version_token_guard(
    session_factory: async_sessionmaker[AsyncSession],
    mock_ai_provider: Any,
) -> None:
    async with session_factory() as session:
        author = await create_test_user(session, user_id=40, role="user")
        pitch = await create_test_pitch(
            session,
            author_id=author.id,
            title="Initial Title",
            description="Initial description.",
            content="First paragraph here.\nSecond paragraph here.",
        )

        initial_token = compute_pitch_hash(pitch.title, pitch.description, pitch.content)

        # Create critique with 2 suggestions
        critique = PitchCritique(
            id=uuid.uuid4(),
            pitch_id=pitch.id,
            base_hash=initial_token,
            current_hash=initial_token,
            summary="Great start.",
            strengths=["Concise"],
        )
        session.add(critique)

        sug1 = PitchSuggestion(
            id=uuid.uuid4(),
            critique_id=critique.id,
            pitch_id=pitch.id,
            base_hash=initial_token,
            field="title",
            section_label="Title",
            severity="major",
            title="Better Title",
            original_excerpt="Initial Title",
            suggested_text="Revolutionary Nexus Project",
            rationale="Captures attention.",
            status="pending",
        )
        sug2 = PitchSuggestion(
            id=uuid.uuid4(),
            critique_id=critique.id,
            pitch_id=pitch.id,
            base_hash=initial_token,
            field="content",
            section_label="Content",
            severity="minor",
            title="Expand First Paragraph",
            original_excerpt="First paragraph here.",
            suggested_text="Enhanced first paragraph with deeper insights.",
            rationale="Adds depth.",
            status="pending",
        )
        session.add_all([sug1, sug2])
        await session.commit()

        # 1. Apply suggestion 1 with correct initial_token
        res1 = await apply_pitch_suggestion(session, pitch.id, sug1.id, initial_token, author)
        assert res1.status == "applied"
        assert res1.applied_field == "title"
        token_after_sug1 = res1.new_version_token
        assert token_after_sug1 != initial_token

        # Verify pitch in DB was updated
        pitch_db = (await session.execute(select(Pitch).where(Pitch.id == pitch.id))).scalar_one()
        assert pitch_db.title == "Revolutionary Nexus Project"

        # 2. Try applying suggestion 2 with OLD initial_token -> 409 Conflict!
        with pytest.raises(HTTPException) as exc_info:
            await apply_pitch_suggestion(session, pitch.id, sug2.id, initial_token, author)
        assert exc_info.value.status_code == 409
        assert "version token mismatch" in exc_info.value.detail

        # 3. Apply suggestion 2 with NEW token_after_sug1 -> Success!
        res2 = await apply_pitch_suggestion(session, pitch.id, sug2.id, token_after_sug1, author)
        assert res2.status == "applied"
        assert res2.applied_field == "content"

        # Verify pitch has both changes applied
        pitch_db_final = (
            await session.execute(select(Pitch).where(Pitch.id == pitch.id))
        ).scalar_one()
        assert pitch_db_final.title == "Revolutionary Nexus Project"
        assert "Enhanced first paragraph with deeper insights." in pitch_db_final.content


@pytest.mark.asyncio
async def test_stale_detection_and_dismiss(
    session_factory: async_sessionmaker[AsyncSession],
    mock_ai_provider: Any,
) -> None:
    async with session_factory() as session:
        author = await create_test_user(session, user_id=50, role="user")
        pitch = await create_test_pitch(
            session, author_id=author.id, title="Pitch A", content="Content A"
        )
        base_hash = compute_pitch_hash(pitch.title, pitch.description, pitch.content)

        job = AIJob(
            id=uuid.uuid4(),
            job_type="pitch.refine",
            status="succeeded",
            payload={"pitch_id": str(pitch.id), "base_hash": base_hash},
        )
        session.add(job)

        critique = PitchCritique(
            id=uuid.uuid4(),
            pitch_id=pitch.id,
            job_id=job.id,
            base_hash=base_hash,
            current_hash=base_hash,
            summary="Assessment text",
            strengths=["Strength 1"],
        )
        session.add(critique)

        sug = PitchSuggestion(
            id=uuid.uuid4(),
            critique_id=critique.id,
            pitch_id=pitch.id,
            base_hash=base_hash,
            field="title",
            section_label="Title",
            severity="minor",
            title="Change title",
            original_excerpt="Pitch A",
            suggested_text="Pitch A+",
            rationale="Better",
            status="pending",
        )
        session.add(sug)
        await session.commit()

        # 1. Status when untouched -> is_stale == False
        status_res = await get_pitch_refine_status(session, pitch.id, author)
        assert status_res.status == "succeeded"
        assert status_res.is_stale is False
        assert len(status_res.suggestions) == 1

        # 2. External edit to pitch content -> is_stale == True
        pitch.content = "Content A with external manual edit"
        await session.commit()

        status_res_edited = await get_pitch_refine_status(session, pitch.id, author)
        assert status_res_edited.is_stale is True

        # 3. Dismiss suggestion
        dismiss_res = await dismiss_pitch_suggestion(session, pitch.id, sug.id, author)
        assert dismiss_res.status == "dismissed"

        sug_db = (
            await session.execute(select(PitchSuggestion).where(PitchSuggestion.id == sug.id))
        ).scalar_one()
        assert sug_db.status == "dismissed"

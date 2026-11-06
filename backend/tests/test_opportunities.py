from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.user.opportunities.apply.models import Application
from app.user.opportunities.apply.service import apply_to_opportunity
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.opportunities.browse_opportunities.service import browse_opportunities
from app.user.opportunities.create_opportunity.schemas import CreateOpportunityRequest
from app.user.opportunities.create_opportunity.service import create_opportunity
from app.user.opportunities.match_scoring.service import (
    calculate_match_score,
    score_opportunity_applications,
)
from app.user.opportunities.publish_opportunity.service import publish_opportunity
from app.user.opportunities.review_applications.service import (
    update_application_status,
)
from app.user.opportunities.update_opportunity.schemas import UpdateOpportunityRequest
from app.user.opportunities.update_opportunity.service import update_opportunity
from app.user.opportunities.view_opportunity.service import view_opportunity
from app.user.opportunities.withdraw_application.service import withdraw_application


def database_result(*, rows=None, scalar=None):
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows or []
    result.scalar_one_or_none.return_value = scalar
    return result


def application(*, status="pending", candidate_skills=None):
    return SimpleNamespace(
        id=uuid4(),
        opportunity_id=uuid4(),
        user_id=uuid4(),
        status=status,
        message="Application message",
        candidate_skills=candidate_skills or [],
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
        updated_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_create_opportunity():
    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    project_id = uuid4()

    result = await create_opportunity(
        db=db,
        project_id=project_id,
        title="Backend project",
        description="Build an API",
        required_skills=["Python", "FastAPI"],
    )

    assert result.project_id == project_id
    assert result.title == "Backend project"
    assert result.required_skills == ["Python", "FastAPI"]
    db.add.assert_called_once_with(result)
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(result)


@pytest.mark.asyncio
async def test_browse_opportunities_returns_database_rows():
    opportunities = [SimpleNamespace(id=uuid4()), SimpleNamespace(id=uuid4())]
    db = MagicMock()
    db.execute = AsyncMock(return_value=database_result(rows=opportunities))

    result = await browse_opportunities(db=db, skip=2, limit=10)

    assert result == opportunities
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_view_opportunity_returns_matching_row():
    opportunity = SimpleNamespace(id=uuid4())
    db = MagicMock()
    db.execute = AsyncMock(return_value=database_result(scalar=opportunity))

    result = await view_opportunity(db=db, opportunity_id=opportunity.id)

    assert result is opportunity
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_opportunity_changes_only_provided_fields():
    opportunity = SimpleNamespace(
        id=uuid4(),
        title="Old title",
        description="Old description",
        required_skills=["Python"],
    )
    db = MagicMock()
    db.get = AsyncMock(return_value=opportunity)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    result = await update_opportunity(
        db=db,
        opportunity_id=opportunity.id,
        title="New title",
        required_skills=["Python", "FastAPI"],
    )

    assert result is opportunity
    assert opportunity.title == "New title"
    assert opportunity.description == "Old description"
    assert opportunity.required_skills == ["Python", "FastAPI"]
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(opportunity)


@pytest.mark.asyncio
async def test_update_opportunity_rejects_missing_opportunity():
    db = MagicMock()
    db.get = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="Opportunity not found"):
        await update_opportunity(db=db, opportunity_id=uuid4(), title="New title")

    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_publish_opportunity_sets_status_to_open():
    opportunity = SimpleNamespace(id=uuid4(), status="draft")
    db = MagicMock()
    db.get = AsyncMock(return_value=opportunity)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    result = await publish_opportunity(db=db, opportunity_id=opportunity.id)

    assert result is opportunity
    assert opportunity.status == "open"
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(opportunity)


@pytest.mark.asyncio
async def test_apply_to_opportunity_stores_candidate_skills():
    opportunity_id = uuid4()
    user_id = uuid4()
    opportunity = SimpleNamespace(id=opportunity_id, status="open")
    db = MagicMock()
    db.get = AsyncMock(return_value=opportunity)
    db.execute = AsyncMock(return_value=database_result())
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    result = await apply_to_opportunity(
        db=db,
        opportunity_id=opportunity_id,
        user_id=user_id,
        message="I am interested",
        candidate_skills=["Python", "FastAPI"],
    )

    assert result.opportunity_id == opportunity_id
    assert result.user_id == user_id
    assert result.candidate_skills == ["Python", "FastAPI"]
    db.add.assert_called_once_with(result)
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(result)


@pytest.mark.asyncio
async def test_apply_to_closed_opportunity_is_rejected():
    db = MagicMock()
    db.get = AsyncMock(return_value=SimpleNamespace(status="draft"))

    with pytest.raises(
        ValueError,
        match="Opportunity is not open for applications",
    ):
        await apply_to_opportunity(
            db=db,
            opportunity_id=uuid4(),
            user_id=uuid4(),
        )

    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_score_opportunity_applications_ranks_highest_match_first():
    opportunity = SimpleNamespace(required_skills=["Python", "FastAPI"])
    highest = application(candidate_skills=["Python", "FastAPI"])
    lowest = application(candidate_skills=["Python"])
    db = MagicMock()
    db.get = AsyncMock(return_value=opportunity)
    db.execute = AsyncMock(
        return_value=database_result(rows=[lowest, highest]),
    )

    result = await score_opportunity_applications(
        db=db,
        opportunity_id=uuid4(),
    )

    assert result == [(highest, 100.0), (lowest, 50.0)]


@pytest.mark.asyncio
async def test_update_application_status_allows_valid_transition():
    record = application(status="pending")
    db = MagicMock()
    db.get = AsyncMock(return_value=record)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    result = await update_application_status(
        db=db,
        application_id=record.id,
        new_status="under_review",
    )

    assert result is record
    assert record.status == "under_review"
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(record)


@pytest.mark.asyncio
async def test_update_application_status_rejects_terminal_transition():
    record = application(status="accepted")
    db = MagicMock()
    db.get = AsyncMock(return_value=record)
    db.commit = AsyncMock()

    with pytest.raises(
        ValueError,
        match="Cannot change application status from accepted to rejected",
    ):
        await update_application_status(
            db=db,
            application_id=record.id,
            new_status="rejected",
        )

    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_withdraw_application_deletes_existing_application():
    record = application()
    db = MagicMock()
    db.execute = AsyncMock(return_value=database_result(scalar=record))
    db.delete = AsyncMock()
    db.commit = AsyncMock()

    result = await withdraw_application(
        db=db,
        opportunity_id=record.opportunity_id,
        user_id=record.user_id,
    )

    assert result is None
    db.delete.assert_awaited_once_with(record)
    db.commit.assert_awaited_once()


def test_create_opportunity_request_validates_required_fields():
    request = CreateOpportunityRequest(
        project_id=uuid4(),
        title="Backend project",
        description="Build an API",
    )

    assert request.required_skills == []

    with pytest.raises(ValidationError):
        CreateOpportunityRequest(
            project_id=uuid4(),
            title="",
            description="Build an API",
        )


def test_update_opportunity_request_requires_a_field():
    with pytest.raises(
        ValidationError,
        match="At least one opportunity field must be provided",
    ):
        UpdateOpportunityRequest()


def test_calculate_match_score_full_match() -> None:
    required = ["Python", "FastAPI", "Docker"]
    candidate = ["python", "docker", "fastapi", "react"]
    score = calculate_match_score(required, candidate)
    assert score == 100.0


def test_calculate_match_score_partial_match() -> None:
    required = ["Python", "FastAPI", "Docker", "Kubernetes"]
    candidate = ["python", "docker", "c++"]
    score = calculate_match_score(required, candidate)
    assert score == 50.0


def test_calculate_match_score_no_match() -> None:
    required = ["Rust", "Wasm"]
    candidate = ["Python", "Django"]
    score = calculate_match_score(required, candidate)
    assert score == 0.0


def test_calculate_match_score_empty_required_skills() -> None:
    score = calculate_match_score([], ["Python"])
    assert score == 0.0


def test_opportunity_model_instantiation() -> None:
    opp = Opportunity(
        id=uuid4(),
        project_id=uuid4(),
        title="Lead Frontend",
        description="React and Tailwind specialist",
        required_skills=["React", "TypeScript"],
        status="open",
    )
    assert opp.title == "Lead Frontend"
    assert opp.status == "open"
    assert opp.required_skills == ["React", "TypeScript"]


def test_application_model_instantiation() -> None:
    new_application = Application(
        id=uuid4(),
        opportunity_id=uuid4(),
        user_id=uuid4(),
        candidate_skills=["Python", "PostgreSQL"],
        status="pending",
        message="I'd love to join this team!",
    )
    assert new_application.status == "pending"
    assert new_application.candidate_skills == ["Python", "PostgreSQL"]
    assert new_application.message == "I'd love to join this team!"

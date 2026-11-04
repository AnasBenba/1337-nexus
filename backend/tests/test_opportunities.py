from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.opportunities.create_opportunity.schemas import CreateOpportunityRequest
from app.user.opportunities.match_scoring.service import calculate_match_score


def test_calculate_match_score_full_match() -> None:
    """100% match when candidate has all required skills."""
    required = ["Python", "FastAPI", "Docker"]
    candidate = ["python", "docker", "fastapi", "react"]
    score = calculate_match_score(required, candidate)
    assert score == 100.0


def test_calculate_match_score_partial_match() -> None:
    """Partial percentage calculation (2/4 = 50.0%)."""
    required = ["Python", "FastAPI", "Docker", "Kubernetes"]
    candidate = ["python", "docker", "c++"]
    score = calculate_match_score(required, candidate)
    assert score == 50.0


def test_calculate_match_score_no_match() -> None:
    """0% match when candidate has no overlapping skills."""
    required = ["Rust", "Wasm"]
    candidate = ["Python", "Django"]
    score = calculate_match_score(required, candidate)
    assert score == 0.0


def test_calculate_match_score_empty_required_skills() -> None:
    """0.0% when required skills list is empty."""
    score = calculate_match_score([], ["Python"])
    assert score == 0.0


def test_create_opportunity_schema_validation() -> None:
    """Test CreateOpportunityRequest validation rules."""
    proj_id = uuid.uuid4()
    req = CreateOpportunityRequest(
        project_id=proj_id,
        title="Backend Developer",
        description="Looking for an engineer to build APIs",
        required_skills=["Python", "FastAPI"],
    )
    assert req.title == "Backend Developer"
    assert req.project_id == proj_id
    assert len(req.required_skills) == 2

    # Validation: empty title must fail
    with pytest.raises(ValidationError):
        CreateOpportunityRequest(
            project_id=proj_id,
            title="",
            description="Valid description",
        )


def test_opportunity_model_instantiation() -> None:
    """Test Opportunity model creation and default values."""
    opp_id = uuid.uuid4()
    proj_id = uuid.uuid4()

    opp = Opportunity(
        id=opp_id,
        project_id=proj_id,
        title="Lead Frontend",
        description="React and Tailwind specialist",
        required_skills=["React", "TypeScript"],
        status="open",
    )
    assert opp.title == "Lead Frontend"
    assert opp.status == "open"
    assert opp.required_skills == ["React", "TypeScript"]


def test_application_model_instantiation() -> None:
    """Test Application model creation and candidate skills."""
    app_id = uuid.uuid4()
    opp_id = uuid.uuid4()
    user_id = uuid.uuid4()

    application = Application(
        id=app_id,
        opportunity_id=opp_id,
        user_id=user_id,
        candidate_skills=["Python", "PostgreSQL"],
        status="pending",
        message="I'd love to join this team!",
    )
    assert application.status == "pending"
    assert application.candidate_skills == ["Python", "PostgreSQL"]
    assert application.message == "I'd love to join this team!"

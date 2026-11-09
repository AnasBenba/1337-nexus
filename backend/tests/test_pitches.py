from __future__ import annotations

import uuid

import pytest

from app.core.db import engine
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCategory, PitchCreate, PitchStatus
from app.user.pitches.utils import render_and_sanitize


@pytest.fixture(autouse=True)
async def dispose_engine_connections() -> None:
    await engine.dispose()
    yield
    await engine.dispose()


def test_render_and_sanitize_basic_markdown() -> None:
    """Test standard Markdown headers, bold, and lists render to clean HTML."""
    raw = "# My Pitch\n\n**Bold Statement**\n\n- Point 1\n- Point 2"
    html = render_and_sanitize(raw)
    assert "<h1>My Pitch</h1>" in html
    assert "<strong>Bold Statement</strong>" in html
    assert "<ul>" in html
    assert "<li>Point 1</li>" in html


def test_render_and_sanitize_strips_malicious_script_tags() -> None:
    """Test XSS defense: bleach strips <script> and dangerous tags."""
    raw = "Hello <script>alert('xss')</script> world <img src='x' onerror='alert(1)'>"
    html = render_and_sanitize(raw)
    assert "<script>" not in html
    assert "</script>" not in html
    assert "<img" not in html
    assert "onerror" not in html
    assert "Hello" in html
    assert "world" in html


def test_render_and_sanitize_empty_input() -> None:
    """Empty string returns empty string."""
    assert render_and_sanitize("") == ""


def test_pitch_schemas_validation() -> None:
    """Test PitchCreate schema with categories."""
    pitch_in = PitchCreate(
        title="Peer Code Review Network",
        content="## Summary\nA network for 1337 peer code reviews.",
        category=PitchCategory.EDUCATION,
        description="A student platform for reviews",
    )
    assert pitch_in.title == "Peer Code Review Network"
    assert pitch_in.category == PitchCategory.EDUCATION
    assert pitch_in.description == "A student platform for reviews"


def test_pitch_model_instantiation() -> None:
    """Test Pitch ORM model instantiation and default status."""
    pitch_id = uuid.uuid4()
    author_id = uuid.uuid4()
    pitch = Pitch(
        id=pitch_id,
        title="Automated Logistics Hub",
        content="Autonomous delivery drones for campus",
        rendered_content="<p>Autonomous delivery drones for campus</p>",
        category=PitchCategory.TECH.value,
        status=PitchStatus.DRAFT.value,
        author_id=author_id,
    )
    assert pitch.id == pitch_id
    assert pitch.title == "Automated Logistics Hub"
    assert pitch.category == "Technology"
    assert pitch.status == "draft"
    assert pitch.author_id == author_id


@pytest.mark.asyncio
async def test_create_pitch_api_endpoint() -> None:
    """Test creating a pitch via API endpoint with dev fallback and with authenticated user."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Dev fallback: creates pitch with zero credentials in Swagger UI style
        res = await client.post(
            "/api/v1/user/pitches",
            json={
                "title": "Swagger Test Pitch",
                "content": "Building an awesome autonomous drone system",
                "category": PitchCategory.TECH.value,
                "description": "Zero friction Swagger UI test",
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "Swagger Test Pitch"
        assert data["author_id"] is not None

        # 2. Authenticated user: registers user and creates pitch
        unique_login = f"founder_{uuid.uuid4().hex[:6]}"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={
                "login": unique_login,
                "email": f"{unique_login}@1337.ma",
                "fullname": "Founder Student",
                "password": "Password123!",
            },
        )
        assert reg_res.status_code == 201
        user_info = reg_res.json()["user"]
        token = reg_res.json()["access_token"]

        pitch_res = await client.post(
            "/api/v1/user/pitches",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "title": "Founder Auth Pitch",
                "content": "Peer-to-peer workspace sharing",
                "category": PitchCategory.TECH.value,
            },
        )
        assert pitch_res.status_code == 201
        assert pitch_res.json()["author_id"] == user_info["id"]

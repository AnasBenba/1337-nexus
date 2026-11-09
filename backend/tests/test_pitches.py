from __future__ import annotations

import uuid

from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCategory, PitchCreate, PitchStatus
from app.user.pitches.utils import render_and_sanitize


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
    pitch = Pitch(
        id=pitch_id,
        title="Automated Logistics Hub",
        content="Autonomous delivery drones for campus",
        rendered_content="<p>Autonomous delivery drones for campus</p>",
        category=PitchCategory.TECH.value,
        status=PitchStatus.DRAFT.value,
        author_id=uuid.uuid4(),
    )
    assert pitch.id == pitch_id
    assert pitch.title == "Automated Logistics Hub"
    assert pitch.category == "Technology"
    assert pitch.status == "draft"
    assert isinstance(pitch.author_id, uuid.UUID)

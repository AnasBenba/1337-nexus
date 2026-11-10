from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.main import app
from app.teams.models import (
    WorkspaceBoard,
    WorkspaceCanvasDocument,
    WorkspaceChannel,
    WorkspaceTeam,
)
from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch


@pytest.mark.asyncio
async def test_full_opportunities_and_recruitment_lifecycle_against_real_database() -> None:
    """End-to-end integration test exercising the full Opportunity and Recruitment lifecycle

    against real PostgreSQL without mocks:
    - Pitch creation -> Opportunity creation
    - Schema validation & invalid FK 404 guards
    - Publication & open status transition
    - Candidate application with JSONB skills & duplicate prevention
    - Founder acceptance triggering automatic Workspace provisioning in PostgreSQL
    - Cascade deletion integrity.
    """
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url, poolclass=NullPool)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register a project founder
        founder_login = f"founder_{uuid.uuid4().hex[:8]}"
        reg_founder = await client.post(
            "/api/v1/auth/register",
            json={
                "login": founder_login,
                "email": f"{founder_login}@1337.ma",
                "fullname": "Founder Test",
                "password": "Password123!",
            },
        )
        assert reg_founder.status_code == 201
        founder_token = reg_founder.json()["access_token"]
        founder_headers = {"Authorization": f"Bearer {founder_token}"}

        # 2. Create a pitch for this founder
        pitch_res = await client.post(
            "/api/v1/user/pitches",
            headers=founder_headers,
            json={
                "title": "Quantum Compute Engine",
                "content": "A high-performance quantum circuit simulation runtime.",
                "category": "Technology",
                "description": "Quantum accelerator simulation",
            },
        )
        assert pitch_res.status_code == 201
        pitch_id = uuid.UUID(pitch_res.json()["id"])

        # 3. Guard test: creating an opportunity with a non-existent pitch returns 404
        fake_id = uuid.uuid4()
        bad_opp = await client.post(
            "/opportunities/",
            headers=founder_headers,
            json={
                "project_id": str(fake_id),
                "title": "Quantum Algorithmist",
                "description": "Looking for circuit designer",
                "required_skills": ["Qiskit", "Python"],
            },
        )
        assert bad_opp.status_code == 404

        # 4. Create real opportunity tied to the pitch
        create_opp = await client.post(
            "/opportunities/",
            headers=founder_headers,
            json={
                "project_id": str(pitch_id),
                "title": "Quantum Algorithmist",
                "description": "Looking for circuit designer",
                "required_skills": ["Qiskit", "Python", "C++"],
            },
        )
        assert create_opp.status_code == 201
        opp_data = create_opp.json()
        opp_id = uuid.UUID(opp_data["id"])
        assert opp_data["status"] == "draft"
        assert opp_data["required_skills"] == ["Qiskit", "Python", "C++"]

        # 5. Verify the opportunity exists in real PostgreSQL
        async with AsyncSession(engine) as session:
            db_opp = await session.get(Opportunity, opp_id)
            assert db_opp is not None
            assert db_opp.title == "Quantum Algorithmist"
            assert db_opp.project_id == pitch_id

        # 6. Update opportunity details
        update_res = await client.put(
            f"/opportunities/{opp_id}",
            headers=founder_headers,
            json={
                "title": "Lead Quantum Algorithmist",
                "description": "Senior circuit designer with Cirq experience",
                "required_skills": ["Qiskit", "Cirq", "Python"],
            },
        )
        assert update_res.status_code == 200
        assert update_res.json()["title"] == "Lead Quantum Algorithmist"

        # 7. Publish the opportunity
        publish_res = await client.post(
            f"/opportunities/{opp_id}/publish",
            headers=founder_headers,
        )
        assert publish_res.status_code == 200
        assert publish_res.json()["status"] == "open"

        # 8. Browse opportunities -> should include our published opportunity
        browse_res = await client.get("/opportunities/")
        assert browse_res.status_code == 200
        items = browse_res.json()
        assert any(item["id"] == str(opp_id) for item in items)

        # 9. Register a candidate student
        candidate_login = f"candidate_{uuid.uuid4().hex[:8]}"
        reg_cand = await client.post(
            "/api/v1/auth/register",
            json={
                "login": candidate_login,
                "email": f"{candidate_login}@1337.ma",
                "fullname": "Candidate Test",
                "password": "Password123!",
            },
        )
        assert reg_cand.status_code == 201
        candidate_id = uuid.UUID(reg_cand.json()["user"]["id"])
        cand_token = reg_cand.json()["access_token"]
        cand_headers = {"Authorization": f"Bearer {cand_token}"}

        # 10. Candidate applies to the opportunity
        apply_res = await client.post(
            f"/opportunities/{opp_id}/apply",
            headers=cand_headers,
            json={
                "user_id": str(candidate_id),
                "message": "I built quantum simulators in 42 common core.",
                "candidate_skills": ["Python", "Cirq", "C++"],
            },
        )
        assert apply_res.status_code in (200, 201)
        app_data = apply_res.json()
        app_id = uuid.UUID(app_data["id"])
        assert app_data["status"] == "pending"

        # 11. Constraint check: duplicate application from same student must fail
        dup_apply = await client.post(
            f"/opportunities/{opp_id}/apply",
            headers=cand_headers,
            json={
                "user_id": str(candidate_id),
                "message": "Applying again",
                "candidate_skills": ["Python"],
            },
        )
        assert dup_apply.status_code in (400, 409)

        # 12. Founder reviews and accepts the candidate
        accept_res = await client.post(
            f"/applications/{app_id}/status",
            headers=founder_headers,
            json={"status": "accepted"},
        )
        assert accept_res.status_code == 200
        assert accept_res.json()["status"] == "accepted"

        # 13. Verify automatic Workspace provisioning actually happened in PostgreSQL
        async with AsyncSession(engine) as session:
            team_res = await session.execute(
                select(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == opp_id)
            )
            team = team_res.scalar_one_or_none()
            assert team is not None
            assert team.opportunity_id == opp_id

            board_res = await session.execute(
                select(WorkspaceBoard).where(WorkspaceBoard.team_id == team.id)
            )
            assert board_res.scalar_one_or_none() is not None

            canvas_res = await session.execute(
                select(WorkspaceCanvasDocument).where(WorkspaceCanvasDocument.team_id == team.id)
            )
            assert canvas_res.scalar_one_or_none() is not None

            channel_res = await session.execute(
                select(WorkspaceChannel).where(WorkspaceChannel.team_id == team.id)
            )
            assert channel_res.scalar_one_or_none() is not None

        # 14. Test cascading delete: deleting the pitch must cascade to opportunity and application
        del_pitch = await client.delete(
            f"/api/v1/user/pitches/{pitch_id}",
            headers=founder_headers,
        )
        assert del_pitch.status_code == 200

        async with AsyncSession(engine) as session:
            # Pitch is gone
            p_check = await session.get(Pitch, pitch_id)
            assert p_check is None

            # Opportunity is cascaded away
            o_check = await session.get(Opportunity, opp_id)
            assert o_check is None

            # Application is cascaded away
            a_check = await session.get(Application, app_id)
            assert a_check is None

    await engine.dispose()

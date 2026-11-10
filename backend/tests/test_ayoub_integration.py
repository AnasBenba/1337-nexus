from collections.abc import AsyncIterator
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.db import get_db_session
from app.main import create_app
from app.oauth.user import Users
from app.teams.membership import accept_member, invite_member, remove_member
from app.teams.models import WorkspaceTeam, WorkspaceTeamMember
from app.teams.provision_workspace.service import provision_workspace
from app.collaboration.board.service import (
    BoardRevisionConflict,
    create_board_column,
)
from app.user.dependencies import get_current_user
from app.user.opportunities.apply.service import apply_to_opportunity
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.opportunities.create_opportunity.service import create_opportunity
from app.user.opportunities.apply.models import Application
from app.user.opportunities.review_applications.service import update_application_status
from app.user.projects.models import Project


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def db() -> AsyncIterator[AsyncSession]:
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
        await session.execute(
            text(
                "DELETE FROM users WHERE login LIKE 'ayoub-%' OR login LIKE 'other-%'"
            )
        )
        await session.commit()
    await engine.dispose()


async def _create_users(db: AsyncSession) -> tuple[Users, Users]:
    users = [
        Users(login=f"ayoub-{uuid4().hex}", fullname="Ayoub", role="user", intra_id=None),
        Users(login=f"other-{uuid4().hex}", fullname="Other", role="user", intra_id=None),
    ]
    db.add_all(users)
    await db.flush()
    return users[0], users[1]


async def test_protected_project_endpoint_rejects_unauthenticated_request() -> None:
    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/projects",
            json={"title": "Private", "description": "Should not be created"},
        )
    assert response.status_code == 401


async def test_project_and_quick_action_use_authenticated_owner(db: AsyncSession) -> None:
    owner, other = await _create_users(db)
    app = create_app()

    async def override_db() -> AsyncIterator[AsyncSession]:
        yield db

    async def override_user() -> Users:
        return owner

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_current_user] = override_user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post(
            "/quick-actions/create-project",
            json={"title": "Owned", "description": "Created by the authenticated user"},
        )
        assert created.status_code == 201
        payload = created.json()
        assert payload["owner_id"] == str(owner.id)

        app.dependency_overrides[get_current_user] = lambda: other
        forbidden = await client.get(
            "/quick-actions/continue-project",
            params={"project_id": payload["id"]},
        )
        assert forbidden.status_code == 200
        assert forbidden.json() is None

    assert other.id != owner.id
    app.dependency_overrides.clear()


async def test_duplicate_application_is_rejected_by_service_and_constraint(
    db: AsyncSession,
) -> None:
    owner, applicant = await _create_users(db)
    project = Project(owner_id=owner.id, title="Project", description="Description")
    db.add(project)
    await db.flush()
    opportunity = await create_opportunity(
        db,
        project_id=project.id,
        title="Backend",
        description="Help",
        required_skills=["Python"],
    )
    opportunity.status = "open"
    await db.commit()

    await apply_to_opportunity(db, opportunity.id, applicant.id)
    with pytest.raises(ValueError, match="already applied"):
        await apply_to_opportunity(db, opportunity.id, applicant.id)


async def test_workspace_provisioning_is_idempotent_and_adds_founder_member(
    db: AsyncSession,
) -> None:
    owner, _ = await _create_users(db)
    opportunity_id = uuid4()
    first = await provision_workspace(db, opportunity_id=opportunity_id, founder_id=owner.id)
    await db.commit()
    second = await provision_workspace(db, opportunity_id=opportunity_id, founder_id=owner.id)

    assert second.team.id == first.team.id
    member = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == first.team.id,
            WorkspaceTeamMember.user_id == owner.id,
        )
    )
    assert member is not None
    assert member.status == "active"


async def test_team_membership_authorization_and_founder_protection(
    db: AsyncSession,
) -> None:
    owner, other = await _create_users(db)
    team = WorkspaceTeam(opportunity_id=uuid4(), founder_id=owner.id)
    db.add(team)
    await db.flush()

    with pytest.raises(PermissionError):
        await invite_member(db, team_id=team.id, inviter_id=other.id, user_id=other.id)

    member = await invite_member(db, team_id=team.id, inviter_id=owner.id, user_id=other.id)
    await accept_member(db, team_id=team.id, user_id=other.id)
    await remove_member(db, team_id=team.id, remover_id=owner.id, user_id=other.id)
    assert member.user_id == other.id

    with pytest.raises(ValueError, match="founder cannot"):
        await remove_member(db, team_id=team.id, remover_id=owner.id, user_id=owner.id)


async def test_migrations_expose_required_constraints(db: AsyncSession) -> None:
    async with db.bind.connect() as connection:
        tables = await connection.run_sync(lambda conn: inspect(conn).get_table_names())
        assert {"projects", "opportunities", "applications", "workspace_teams"} <= set(tables)

    result = await db.execute(
        text(
            """
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE table_name IN ('projects', 'applications', 'workspace_teams',
                                 'workspace_team_members')
              AND column_name IN ('owner_id', 'user_id', 'founder_id')
            """
        )
    )
    columns = {(row.table_name, row.column_name): row.data_type for row in result}
    assert columns[("projects", "owner_id")] == "uuid"
    assert columns[("applications", "user_id")] == "uuid"
    assert columns[("workspace_teams", "founder_id")] == "uuid"
    assert columns[("workspace_team_members", "user_id")] == "uuid"

    constraints = await db.scalars(
        text(
            """
            SELECT conname
            FROM pg_constraint
            WHERE conname IN (
                'projects_owner_id_fkey',
                'applications_user_id_fkey',
                'workspace_teams_founder_id_fkey',
                'workspace_team_members_user_id_fkey',
                'uq_application_user_opportunity'
            )
            """
        )
    )
    assert {
        "projects_owner_id_fkey",
        "applications_user_id_fkey",
        "workspace_teams_founder_id_fkey",
        "workspace_team_members_user_id_fkey",
        "uq_application_user_opportunity",
    } <= set(constraints.all())


async def test_kanban_revision_guard_rejects_stale_writer(db: AsyncSession) -> None:
    owner, _ = await _create_users(db)
    workspace = await provision_workspace(db, opportunity_id=uuid4(), founder_id=owner.id)
    await db.commit()
    board = workspace.board

    await create_board_column(
        db,
        board_id=board.id,
        name="Doing",
        expected_board_revision=0,
        user_id=owner.id,
    )
    with pytest.raises(BoardRevisionConflict):
        await create_board_column(
            db,
            board_id=board.id,
            name="Blocked",
            expected_board_revision=0,
            user_id=owner.id,
        )


async def test_workspace_acceptance_rolls_back_on_provisioning_failure(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner, applicant = await _create_users(db)
    project = Project(owner_id=owner.id, title="Project", description="Description")
    db.add(project)
    await db.flush()
    opportunity = await create_opportunity(
        db,
        project_id=project.id,
        title="Backend",
        description="Help",
        required_skills=[],
    )
    application = Application(
        opportunity_id=opportunity.id,
        user_id=applicant.id,
        candidate_skills=[],
    )
    db.add(application)
    await db.commit()

    async def fail_provision(*args: object, **kwargs: object) -> None:
        raise RuntimeError("workspace bootstrap failed")

    monkeypatch.setattr(
        "app.user.opportunities.review_applications.service.provision_workspace_for_application",
        fail_provision,
    )
    with pytest.raises(RuntimeError, match="workspace bootstrap failed"):
        await update_application_status(
            db,
            application_id=application.id,
            new_status="accepted",
            current_user_id=owner.id,
        )

    await db.refresh(application)
    assert application.status == "pending"

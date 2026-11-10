"""Strict integration test for workspace provisioning against real PostgreSQL.

Existing test_workspace_provisioning.py uses MagicMock for the DB session,
which means it can never detect:
  - Missing tables in PostgreSQL
  - Wrong foreign key references
  - UniqueConstraint violations
  - Transaction rollback behaviour with real rows

This file exercises provision_workspace() and provision_workspace_for_application()
directly against the real database, verifying every table row was actually written.

NOTE: IDs are always captured *inside* the session context, before commit() expires
the SQLAlchemy instances. This avoids DetachedInstanceError.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import NullPool, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import get_settings
from app.teams.models import (
    WorkspaceBoard,
    WorkspaceCanvasDocument,
    WorkspaceChannel,
    WorkspaceTeam,
)
from app.teams.provision_workspace.service import (
    provision_workspace,
    provision_workspace_for_application,
)
from app.user.opportunities.apply.models import Application


@pytest.fixture
def engine():
    settings = get_settings()
    return create_async_engine(settings.async_database_url, poolclass=NullPool)


# ---------------------------------------------------------------------------
# 1. Provision creates all 4 rows in real PostgreSQL
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_provision_workspace_writes_all_rows_to_postgresql(engine) -> None:
    """Calls provision_workspace() with a real AsyncSession and asserts every
    row (WorkspaceTeam, WorkspaceBoard, WorkspaceCanvasDocument, WorkspaceChannel)
    is physically stored in PostgreSQL."""
    opportunity_id = uuid.uuid4()
    founder_id = uuid.uuid4()

    # Capture IDs before the session closes (objects expire on commit)
    async with AsyncSession(engine) as session:
        result = await provision_workspace(
            session,
            opportunity_id=opportunity_id,
            founder_id=founder_id,
        )
        team_id = result.team.id
        board_id = result.board.id
        canvas_id = result.canvas.id
        channel_id = result.channel.id
        await session.commit()

    # Re-open a fresh session to prove rows persist independently
    async with AsyncSession(engine) as session:
        team = await session.get(WorkspaceTeam, team_id)
        assert team is not None, "WorkspaceTeam row not found in workspace_teams table"
        assert team.opportunity_id == opportunity_id
        assert team.founder_id == founder_id

        board = await session.get(WorkspaceBoard, board_id)
        assert board is not None, "WorkspaceBoard row not found in workspace_boards table"
        assert board.team_id == team_id
        assert board.board_revision == 0

        canvas = await session.get(WorkspaceCanvasDocument, canvas_id)
        assert canvas is not None, "WorkspaceCanvasDocument row not found"
        assert canvas.team_id == team_id

        channel = await session.get(WorkspaceChannel, channel_id)
        assert channel is not None, "WorkspaceChannel row not found in workspace_channels table"
        assert channel.team_id == team_id


# ---------------------------------------------------------------------------
# 2. Idempotency: calling provision_workspace twice returns existing rows
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_provision_workspace_is_idempotent_in_postgresql(engine) -> None:
    """A second call with the same opportunity_id must return the already-
    provisioned rows without duplicating them in PostgreSQL."""
    opportunity_id = uuid.uuid4()
    founder_id = uuid.uuid4()

    async with AsyncSession(engine) as session:
        first = await provision_workspace(session, opportunity_id=opportunity_id, founder_id=founder_id)
        first_team_id = first.team.id
        first_board_id = first.board.id
        first_canvas_id = first.canvas.id
        first_channel_id = first.channel.id
        await session.commit()

    async with AsyncSession(engine) as session:
        second = await provision_workspace(session, opportunity_id=opportunity_id, founder_id=founder_id)
        second_team_id = second.team.id
        second_board_id = second.board.id
        second_canvas_id = second.canvas.id
        second_channel_id = second.channel.id
        await session.commit()

    # Same primary keys — no new rows were created
    assert first_team_id == second_team_id
    assert first_board_id == second_board_id
    assert first_canvas_id == second_canvas_id
    assert first_channel_id == second_channel_id

    # Confirm only one team row exists for this opportunity
    async with AsyncSession(engine) as session:
        teams = (
            await session.execute(
                select(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == opportunity_id)
            )
        ).scalars().all()
        assert len(teams) == 1, f"Expected 1 team, found {len(teams)}"


# ---------------------------------------------------------------------------
# 3. Provision via Application object (provision_workspace_for_application)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_provision_workspace_for_application_writes_rows(engine) -> None:
    """provision_workspace_for_application() must correctly derive opportunity_id
    and founder_id from an Application object and persist all workspace rows."""
    opp_id = uuid.uuid4()
    candidate_id = uuid.uuid4()

    # Build a minimal Application-like object (not saved to DB — only the
    # foreign-key fields are needed by provision_workspace_for_application)
    application = Application(
        id=uuid.uuid4(),
        opportunity_id=opp_id,
        user_id=candidate_id,
        status="accepted",
        message="Integration test application",
        candidate_skills=["Python"],
    )

    async with AsyncSession(engine) as session:
        result = await provision_workspace_for_application(session, application)
        team_id = result.team.id
        board_id = result.board.id
        canvas_id = result.canvas.id
        channel_id = result.channel.id
        await session.commit()

    async with AsyncSession(engine) as session:
        team = await session.get(WorkspaceTeam, team_id)
        assert team is not None
        assert team.opportunity_id == opp_id
        assert team.founder_id == candidate_id

        # All child rows must exist
        assert await session.get(WorkspaceBoard, board_id) is not None
        assert await session.get(WorkspaceCanvasDocument, canvas_id) is not None
        assert await session.get(WorkspaceChannel, channel_id) is not None


# ---------------------------------------------------------------------------
# 4. UniqueConstraint: one workspace per opportunity enforced by PostgreSQL
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_workspace_team_unique_constraint_per_opportunity(engine) -> None:
    """PostgreSQL enforces the uq_workspace_team_opportunity constraint.
    Two sequential provisioning calls for the same opportunity_id must result
    in exactly one workspace_team row (idempotency guard)."""
    opportunity_id = uuid.uuid4()
    founder_id = uuid.uuid4()

    # First provision succeeds
    async with AsyncSession(engine) as s1:
        await provision_workspace(s1, opportunity_id=opportunity_id, founder_id=founder_id)
        await s1.commit()

    # Second provision on a fresh session reuses the existing team (no INSERT)
    async with AsyncSession(engine) as s2:
        result = await provision_workspace(s2, opportunity_id=opportunity_id, founder_id=founder_id)
        assert result.team is not None
        await s2.commit()

    # Exactly one row in workspace_teams for this opportunity
    async with AsyncSession(engine) as session:
        count_res = (
            await session.execute(
                select(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == opportunity_id)
            )
        ).scalars().all()
        assert len(count_res) == 1, (
            f"UniqueConstraint violated: {len(count_res)} teams found for one opportunity"
        )


# ---------------------------------------------------------------------------
# 5. Cascade: deleting WorkspaceTeam deletes board, canvas, channel
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_workspace_cascade_delete_removes_all_child_rows(engine) -> None:
    """Deleting the WorkspaceTeam row must cascade to board, canvas, and channel
    via the ON DELETE CASCADE foreign keys defined in the migration."""
    opportunity_id = uuid.uuid4()
    founder_id = uuid.uuid4()

    async with AsyncSession(engine) as session:
        result = await provision_workspace(session, opportunity_id=opportunity_id, founder_id=founder_id)
        team_id = result.team.id
        board_id = result.board.id
        canvas_id = result.canvas.id
        channel_id = result.channel.id
        await session.commit()

    # Delete the team
    async with AsyncSession(engine) as session:
        team = await session.get(WorkspaceTeam, team_id)
        assert team is not None
        await session.delete(team)
        await session.commit()

    # All child rows must be gone
    async with AsyncSession(engine) as session:
        assert await session.get(WorkspaceTeam, team_id) is None, "Team should be deleted"
        assert await session.get(WorkspaceBoard, board_id) is None, (
            "Board must be cascade-deleted with its team"
        )
        assert await session.get(WorkspaceCanvasDocument, canvas_id) is None, (
            "Canvas must be cascade-deleted with its team"
        )
        assert await session.get(WorkspaceChannel, channel_id) is None, (
            "Channel must be cascade-deleted with its team"
        )

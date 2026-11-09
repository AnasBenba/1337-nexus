from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.teams.models import (
    WorkspaceBoard,
    WorkspaceCanvasDocument,
    WorkspaceChannel,
    WorkspaceTeam,
)
from app.teams.provision_workspace.service import provision_workspace
from app.user.opportunities.review_applications.service import (
    update_application_status,
)


@pytest.mark.asyncio
async def test_provision_workspace_creates_all_entities():
    db = MagicMock()
    db.scalar = AsyncMock(return_value=None)
    db.add_all = MagicMock()
    db.flush = AsyncMock()
    opportunity_id = uuid4()
    founder_id = 2

    result = await provision_workspace(
        db,
        opportunity_id=opportunity_id,
        founder_id=founder_id,
    )

    db.add_all.assert_called_once()
    db.flush.assert_awaited_once()
    entities = db.add_all.call_args.args[0]
    assert len(entities) == 5
    assert isinstance(result.team, WorkspaceTeam)
    assert isinstance(result.board, WorkspaceBoard)
    assert isinstance(result.canvas, WorkspaceCanvasDocument)
    assert isinstance(result.channel, WorkspaceChannel)
    assert result.team.opportunity_id == opportunity_id
    assert result.team.founder_id == founder_id
    assert result.board.team is result.team
    assert result.canvas.team is result.team
    assert result.channel.team is result.team


@pytest.mark.asyncio
async def test_provision_workspace_reuses_complete_existing_workspace():
    team = WorkspaceTeam(opportunity_id=uuid4(), founder_id=2)
    board = WorkspaceBoard(team=team)
    canvas = WorkspaceCanvasDocument(team=team)
    channel = WorkspaceChannel(team=team)
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[team, board, canvas, channel])
    db.add_all = MagicMock()
    db.flush = AsyncMock()

    result = await provision_workspace(
        db,
        opportunity_id=team.opportunity_id,
        founder_id=team.founder_id,
    )

    assert result.team is team
    assert result.board is board
    assert result.canvas is canvas
    assert result.channel is channel
    db.add_all.assert_not_called()
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_acceptance_provisions_workspace_in_same_commit(
    monkeypatch: pytest.MonkeyPatch,
):
    application = SimpleNamespace(
        id=uuid4(),
        opportunity_id=uuid4(),
        user_id=2,
        status="pending",
    )
    provision = AsyncMock()
    monkeypatch.setattr(
        "app.user.opportunities.review_applications.service.provision_workspace_for_application",
        provision,
    )
    db = MagicMock()
    db.get = AsyncMock(return_value=application)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    result = await update_application_status(
        db,
        application_id=application.id,
        new_status="accepted",
    )

    assert result is application
    assert application.status == "accepted"
    provision.assert_awaited_once_with(db, application)
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(application)


@pytest.mark.asyncio
async def test_acceptance_rolls_back_status_when_provisioning_fails(
    monkeypatch: pytest.MonkeyPatch,
):
    application = SimpleNamespace(
        id=uuid4(),
        opportunity_id=uuid4(),
        user_id=2,
        status="pending",
    )
    provision = AsyncMock(side_effect=RuntimeError("channel bootstrap failed"))
    monkeypatch.setattr(
        "app.user.opportunities.review_applications.service.provision_workspace_for_application",
        provision,
    )
    db = MagicMock()
    db.get = AsyncMock(return_value=application)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    with pytest.raises(RuntimeError, match="channel bootstrap failed"):
        await update_application_status(
            db,
            application_id=application.id,
            new_status="accepted",
        )

    db.commit.assert_not_awaited()
    db.rollback.assert_awaited_once()

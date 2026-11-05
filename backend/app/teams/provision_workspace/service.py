from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.apply.models import Application

from ..models import (
    WorkspaceBoard,
    WorkspaceCanvasDocument,
    WorkspaceChannel,
    WorkspaceTeam,
)


@dataclass(frozen=True)
class WorkspaceProvisioningResult:
    team: WorkspaceTeam
    board: WorkspaceBoard
    canvas: WorkspaceCanvasDocument
    channel: WorkspaceChannel


async def provision_workspace(
    db: AsyncSession,
    *,
    opportunity_id: UUID,
    founder_id: UUID,
) -> WorkspaceProvisioningResult:
    existing_team = await db.scalar(
        select(WorkspaceTeam).where(
            WorkspaceTeam.opportunity_id == opportunity_id,
        )
    )
    if existing_team is not None:
        board = await db.scalar(
            select(WorkspaceBoard).where(WorkspaceBoard.team_id == existing_team.id)
        )
        canvas = await db.scalar(
            select(WorkspaceCanvasDocument).where(
                WorkspaceCanvasDocument.team_id == existing_team.id
            )
        )
        channel = await db.scalar(
            select(WorkspaceChannel).where(WorkspaceChannel.team_id == existing_team.id)
        )
        if board is None or canvas is None or channel is None:
            raise ValueError("Workspace is incomplete")
        return WorkspaceProvisioningResult(existing_team, board, canvas, channel)

    team = WorkspaceTeam(
        opportunity_id=opportunity_id,
        founder_id=founder_id,
    )
    board = WorkspaceBoard(team=team)
    canvas = WorkspaceCanvasDocument(team=team)
    channel = WorkspaceChannel(team=team)
    db.add_all([team, board, canvas, channel])
    await db.flush()

    return WorkspaceProvisioningResult(team, board, canvas, channel)


async def provision_workspace_for_application(
    db: AsyncSession,
    application: Application,
) -> WorkspaceProvisioningResult:
    return await provision_workspace(
        db,
        opportunity_id=application.opportunity_id,
        founder_id=application.user_id,
    )

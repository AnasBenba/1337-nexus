from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.apply.models import Application
from app.user.pitches.models import Pitch

from ..models import (
    WorkspaceBoard,
    WorkspaceCanvasDocument,
    WorkspaceChannel,
    WorkspaceTeam,
    WorkspaceTeamMember,
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
    founder_member = WorkspaceTeamMember(
        team=team,
        user_id=founder_id,
        status="active",
        role="admin",
    )
    board = WorkspaceBoard(team=team)
    canvas = WorkspaceCanvasDocument(team=team)
    channel = WorkspaceChannel(team=team)
    db.add_all([team, founder_member, board, canvas, channel])
    await db.flush()

    return WorkspaceProvisioningResult(team, board, canvas, channel)


async def provision_workspace_for_application(
    db: AsyncSession,
    application: Application,
) -> WorkspaceProvisioningResult:
    from app.user.opportunities.browse_opportunities.models import Opportunity

    opportunity = await db.get(Opportunity, application.opportunity_id)
    pitch = (
        await db.get(Pitch, opportunity.project_id)
        if opportunity is not None
        else None
    )
    founder_id = (
        pitch.author_id
        if pitch is not None and pitch.author_id is not None
        else application.user_id
    )

    result = await provision_workspace(
        db,
        opportunity_id=application.opportunity_id,
        founder_id=founder_id,
    )

    for member_uid, member_role in (
        (founder_id, "admin"),
        (application.user_id, "member"),
    ):
        existing_member = await db.scalar(
            select(WorkspaceTeamMember).where(
                WorkspaceTeamMember.team_id == result.team.id,
                WorkspaceTeamMember.user_id == member_uid,
            )
        )
        if existing_member is None:
            db.add(
                WorkspaceTeamMember(
                    team_id=result.team.id,
                    user_id=member_uid,
                    status="active",
                    role=member_role,
                )
            )
        elif existing_member.status != "active":
            existing_member.status = "active"

    if pitch is not None:
        pitch_team = await db.scalar(
            select(WorkspaceTeam).where(WorkspaceTeam.pitch_id == pitch.id)
        )
        if pitch_team is not None and pitch_team.id != result.team.id:
            existing_pitch_member = await db.scalar(
                select(WorkspaceTeamMember).where(
                    WorkspaceTeamMember.team_id == pitch_team.id,
                    WorkspaceTeamMember.user_id == application.user_id,
                )
            )
            if existing_pitch_member is None:
                db.add(
                    WorkspaceTeamMember(
                        team_id=pitch_team.id,
                        user_id=application.user_id,
                        status="active",
                        role="member",
                    )
                )
            elif existing_pitch_member.status != "active":
                existing_pitch_member.status = "active"

    await db.flush()
    return result


async def provision_workspace_for_pitch(
    db: AsyncSession,
    pitch: Pitch,
) -> WorkspaceProvisioningResult:
    if pitch.author_id is None:
        raise ValueError("A pitch must have an author to create its team")

    team = await db.scalar(
        select(WorkspaceTeam).where(WorkspaceTeam.pitch_id == pitch.id)
    )
    if team is None:
        team = WorkspaceTeam(
            pitch_id=pitch.id,
            founder_id=pitch.author_id,
        )
        board = WorkspaceBoard(team=team)
        canvas = WorkspaceCanvasDocument(team=team)
        channel = WorkspaceChannel(team=team)
        membership = WorkspaceTeamMember(
            team=team,
            user_id=pitch.author_id,
            status="active",
            role="admin",
        )
        db.add_all([team, board, canvas, channel, membership])
        await db.flush()
        return WorkspaceProvisioningResult(team, board, canvas, channel)

    board = await db.scalar(
        select(WorkspaceBoard).where(WorkspaceBoard.team_id == team.id)
    )
    canvas = await db.scalar(
        select(WorkspaceCanvasDocument).where(
            WorkspaceCanvasDocument.team_id == team.id
        )
    )
    channel = await db.scalar(
        select(WorkspaceChannel).where(WorkspaceChannel.team_id == team.id)
    )
    if board is None or canvas is None or channel is None:
        raise ValueError("Workspace is incomplete")

    founder_membership = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team.id,
            WorkspaceTeamMember.user_id == pitch.author_id,
        )
    )
    if founder_membership is None:
        db.add(
            WorkspaceTeamMember(
                team_id=team.id,
                user_id=pitch.author_id,
                status="active",
                role="admin",
            )
        )
        await db.flush()
    elif founder_membership.role != "admin":
        founder_membership.role = "admin"

    return WorkspaceProvisioningResult(team, board, canvas, channel)

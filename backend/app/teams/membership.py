from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import WorkspaceTeam, WorkspaceTeamMember


async def invite_member(
    db: AsyncSession, *, team_id: UUID, inviter_id: UUID, user_id: UUID
) -> WorkspaceTeamMember:
    team = await db.get(WorkspaceTeam, team_id)
    if team is None:
        raise ValueError("Team not found")
    if team.founder_id != inviter_id:
        raise PermissionError("Only the team founder can invite members")
    existing = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team_id,
            WorkspaceTeamMember.user_id == user_id,
        )
    )
    if existing is not None:
        raise ValueError("User is already a team member")
    member = WorkspaceTeamMember(team_id=team_id, user_id=user_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def accept_member(
    db: AsyncSession, *, team_id: UUID, user_id: UUID
) -> WorkspaceTeamMember:
    member = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team_id,
            WorkspaceTeamMember.user_id == user_id,
        )
    )
    if member is None:
        raise ValueError("Invitation not found")
    if member.status != "invited":
        raise ValueError("Invitation is no longer pending")
    member.status = "active"
    await db.commit()
    await db.refresh(member)
    return member


async def remove_member(
    db: AsyncSession, *, team_id: UUID, remover_id: UUID, user_id: UUID
) -> None:
    team = await db.get(WorkspaceTeam, team_id)
    if team is None:
        raise ValueError("Team not found")
    if team.founder_id != remover_id:
        raise PermissionError("Only the team founder can remove members")
    if user_id == team.founder_id:
        raise ValueError("The team founder cannot be removed")
    member = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team_id,
            WorkspaceTeamMember.user_id == user_id,
        )
    )
    if member is None:
        raise ValueError("Team member not found")
    await db.delete(member)
    await db.commit()

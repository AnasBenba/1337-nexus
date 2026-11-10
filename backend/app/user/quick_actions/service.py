from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.teams.models import WorkspaceTeam
from app.user.projects.models import Project
from app.user.projects.service import create_project


async def quick_create_project(
    db: AsyncSession, *, owner_id: UUID, title: str, description: str
) -> Project:
    return await create_project(
        db, owner_id=owner_id, title=title, description=description
    )


async def find_team(db: AsyncSession, *, opportunity_id: UUID) -> WorkspaceTeam | None:
    return await db.scalar(
        select(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == opportunity_id)
    )


async def continue_project(db: AsyncSession, *, project_id: UUID) -> Project | None:
    return await db.get(Project, project_id)

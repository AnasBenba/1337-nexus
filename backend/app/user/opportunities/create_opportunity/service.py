from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.projects.models import Project


async def create_opportunity(
    db: AsyncSession,
    project_id: UUID,
    title: str,
    description: str,
    required_skills: list[str],
    current_user_id: UUID | None = None,
) -> Opportunity:
    if current_user_id is not None:
        project = await db.get(Project, project_id)
        if project is None:
            raise ValueError("Project not found")
        if project.owner_id != current_user_id:
            raise PermissionError("Only the project owner can create opportunities")
    opportunity = Opportunity(
        project_id=project_id,
        title=title,
        description=description,
        required_skills=required_skills,
    )
    db.add(opportunity)
    await db.commit()
    await db.refresh(opportunity)

    return opportunity

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity


async def create_opportunity(
    db: AsyncSession,
    project_id: UUID,
    title: str,
    description: str,
    required_skills: list[str],
) -> Opportunity:
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
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity


async def update_opportunity(
    db: AsyncSession,
    opportunity_id: UUID,
    title: str | None = None,
    description: str | None = None,
    required_skills: list[str] | None = None,
) -> Opportunity:
    opportunity = await db.get(Opportunity, opportunity_id)

    if opportunity is None:
        raise ValueError("Opportunity not found")

    if title is not None:
        opportunity.title = title
    if description is not None:
        opportunity.description = description
    if required_skills is not None:
        opportunity.required_skills = required_skills

    await db.commit()
    await db.refresh(opportunity)

    return opportunity
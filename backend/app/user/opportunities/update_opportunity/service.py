from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch


async def update_opportunity(
    db: AsyncSession,
    opportunity_id: UUID,
    title: str | None = None,
    description: str | None = None,
    required_skills: list[str] | None = None,
    current_user_id: UUID | None = None,
) -> Opportunity:
    opportunity = await db.get(Opportunity, opportunity_id)

    if opportunity is None:
        raise ValueError("Opportunity not found")
    if current_user_id is not None:
        pitch = await db.get(Pitch, opportunity.project_id)
        if pitch is None:
            raise ValueError("Pitch not found")
        if pitch.author_id != current_user_id:
            raise PermissionError("Only the pitch owner can update opportunities")

    if title is not None:
        opportunity.title = title
    if description is not None:
        opportunity.description = description
    if required_skills is not None:
        opportunity.required_skills = required_skills

    await db.commit()
    await db.refresh(opportunity)

    return opportunity

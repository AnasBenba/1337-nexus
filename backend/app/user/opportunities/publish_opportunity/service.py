from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity


async def publish_opportunity(
    db: AsyncSession,
    opportunity_id: UUID,
) -> Opportunity:
    opportunity = await db.get(Opportunity, opportunity_id)

    if opportunity is None:
        raise ValueError("Opportunity not found")

    opportunity.status = "open"
    await db.commit()
    await db.refresh(opportunity)

    return opportunity
from app.user.opportunities.browse_opportunities.models import Opportunity
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity


async def view_opportunity(
    db: AsyncSession,
    opportunity_id: int,
):
    statement = select(Opportunity).where(
        Opportunity.id == opportunity_id
    )

    result = await db.execute(statement)

    return result.scalar_one_or_none()

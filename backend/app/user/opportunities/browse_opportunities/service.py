from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Opportunity


async def browse_opportunities(
    db: AsyncSession,
    skip: int,
    limit: int,
):
    statement = (
        select(Opportunity)
        .where(Opportunity.status == "open")
        .order_by(Opportunity.id)
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(statement)

    opportunities = result.scalars().all()

    return opportunities
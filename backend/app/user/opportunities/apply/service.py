from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity

from .models import Application


async def apply_to_opportunity(
    db: AsyncSession,
    opportunity_id: UUID,
    user_id: UUID,
    message: str | None = None,
    candidate_skills: list[str] | None = None,
) -> Application:
    opportunity = await db.get(Opportunity, opportunity_id)

    if opportunity is None:
        raise ValueError("Opportunity not found")

    if opportunity.status != "open":
        raise ValueError("Opportunity is not open for applications")

    statement = select(Application).where(
        Application.user_id == user_id,
        Application.opportunity_id == opportunity_id,
    )
    result = await db.execute(statement)

    if result.scalar_one_or_none() is not None:
        raise ValueError("You have already applied")

    application = Application(
        user_id=user_id,
        opportunity_id=opportunity_id,
        message=message,
        candidate_skills=candidate_skills or [],
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)

    return application
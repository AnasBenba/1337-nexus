from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.apply.models import Application
from app.user.pitches.models import Pitch

from .models import Opportunity


async def browse_opportunities(
    db: AsyncSession,
    skip: int,
    limit: int,
    exclude_user_id: UUID | None = None,
):
    statement = select(Opportunity).where(Opportunity.status == "open")
    if exclude_user_id is not None:
        accepted_opp_ids = select(Application.opportunity_id).where(
            Application.user_id == exclude_user_id,
            Application.status == "accepted",
        )
        statement = statement.join(
            Pitch, Pitch.id == Opportunity.project_id
        ).where(
            ((Pitch.author_id.is_(None)) | (Pitch.author_id != exclude_user_id))
            & (~Opportunity.id.in_(accepted_opp_ids))
        )
    statement = statement.order_by(Opportunity.created_at.desc(), Opportunity.id).offset(skip).limit(limit)

    result = await db.execute(statement)

    opportunities = result.scalars().all()

    return opportunities


async def list_my_opportunities(
    db: AsyncSession,
    owner_id: UUID,
) -> list[Opportunity]:
    accepted_opp_ids = select(Application.opportunity_id).where(
        Application.user_id == owner_id,
        Application.status == "accepted",
    )
    statement = (
        select(Opportunity)
        .join(Pitch, Pitch.id == Opportunity.project_id)
        .where(
            or_(
                Pitch.author_id == owner_id,
                Opportunity.id.in_(accepted_opp_ids),
            )
        )
        .order_by(Opportunity.created_at.desc(), Opportunity.id)
    )
    result = await db.execute(statement)
    return list(result.scalars().all())

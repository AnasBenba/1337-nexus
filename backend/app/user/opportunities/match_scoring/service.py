from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity


def calculate_match_score(
    required_skills: list[str],
    candidate_skills: list[str],
) -> float:
    required = {skill.strip().casefold() for skill in required_skills if skill.strip()}
    if not required:
        return 0.0

    candidate = {skill.strip().casefold() for skill in candidate_skills if skill.strip()}
    return round(len(required & candidate) / len(required) * 100, 2)


async def score_opportunity_applications(
    db: AsyncSession,
    opportunity_id: UUID,
) -> list[tuple[Application, float]]:
    opportunity = await db.get(Opportunity, opportunity_id)
    if opportunity is None:
        raise ValueError("Opportunity not found")

    statement = (
        select(Application)
        .where(Application.opportunity_id == opportunity_id)
        .order_by(Application.created_at, Application.id)
    )
    result = await db.execute(statement)
    scored_applications = [
        (
            application,
            calculate_match_score(
                opportunity.required_skills,
                application.candidate_skills,
            ),
        )
        for application in result.scalars().all()
    ]
    scored_applications.sort(key=lambda item: (-item[1], item[0].created_at, item[0].id))
    return scored_applications

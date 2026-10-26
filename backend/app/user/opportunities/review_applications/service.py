from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.opportunities.match_scoring.service import calculate_match_score

ALLOWED_STATUSES = frozenset({"pending", "under_review", "accepted", "rejected"})
ALLOWED_TRANSITIONS = {
    "pending": frozenset({"under_review", "accepted", "rejected"}),
    "under_review": frozenset({"accepted", "rejected"}),
    "accepted": frozenset(),
    "rejected": frozenset(),
}


async def review_applications(
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
    applications = result.scalars().all()
    scored_applications = [
        (
            application,
            calculate_match_score(
                opportunity.required_skills,
                application.candidate_skills,
            ),
        )
        for application in applications
    ]
    scored_applications.sort(key=lambda item: (-item[1], item[0].created_at, item[0].id))
    return scored_applications


async def update_application_status(
    db: AsyncSession,
    application_id: UUID,
    new_status: str,
) -> Application:
    if new_status not in ALLOWED_STATUSES:
        raise ValueError("Invalid application status")

    application = await db.get(Application, application_id)
    if application is None:
        raise ValueError("Application not found")

    allowed_transitions = ALLOWED_TRANSITIONS.get(application.status)
    if allowed_transitions is None or new_status not in allowed_transitions:
        raise ValueError(
            f"Cannot change application status from {application.status} to {new_status}"
        )

    application.status = new_status
    await db.commit()
    await db.refresh(application)
    return application

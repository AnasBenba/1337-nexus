from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.apply.models import Application

ALLOWED_STATUSES = frozenset({"pending", "under_review", "accepted", "rejected"})
ALLOWED_TRANSITIONS = {
    "pending": frozenset({"under_review", "accepted", "rejected"}),
    "under_review": frozenset({"accepted", "rejected"}),
    "accepted": frozenset(),
    "rejected": frozenset(),
}


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

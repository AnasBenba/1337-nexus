from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.teams.provision_workspace.service import provision_workspace_for_application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.projects.models import Project
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
    current_user_id: int | None = None,
) -> Application:
    if new_status not in ALLOWED_STATUSES:
        raise ValueError("Invalid application status")

    application = await db.get(Application, application_id)
    if application is None:
        raise ValueError("Application not found")
    if current_user_id is not None:
        opportunity = await db.scalar(
            select(Opportunity).where(Opportunity.id == application.opportunity_id)
        )
        project = (
            await db.scalar(select(Project).where(Project.id == opportunity.project_id))
            if opportunity is not None
            else None
        )
        if project is None:
            raise ValueError("Opportunity not found")
        if project.owner_id != current_user_id:
            raise PermissionError("Only the project owner can review applications")

    allowed_transitions = ALLOWED_TRANSITIONS.get(application.status)
    if allowed_transitions is None or new_status not in allowed_transitions:
        raise ValueError(
            f"Cannot change application status from {application.status} to {new_status}"
        )

    application.status = new_status
    try:
        if new_status == "accepted":
            await provision_workspace_for_application(db, application)
        await db.commit()
        await db.refresh(application)
    except Exception:
        await db.rollback()
        raise

    return application

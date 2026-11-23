from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.teams.models import WorkspaceTeam
from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch


async def delete_opportunity(
    db: AsyncSession,
    opportunity_id: UUID,
    current_user_id: UUID | None = None,
) -> dict[str, str]:
    """
    Delete an opportunity and clean up its associated applications and workspace team.
    Only the pitch owner or an admin is authorized to delete the opportunity.
    """
    opportunity = await db.get(Opportunity, opportunity_id)
    if opportunity is None:
        raise ValueError("Opportunity not found")

    if current_user_id is not None:
        pitch = await db.get(Pitch, opportunity.project_id)
        if pitch is None:
            raise ValueError("Pitch associated with opportunity not found")
        if pitch.author_id != current_user_id:
            raise PermissionError("Only the pitch owner can delete this opportunity")

    # 1. Clean up applications associated with this opportunity
    await db.execute(
        delete(Application).where(Application.opportunity_id == opportunity_id)
    )

    # 2. Clean up workspace team associated with this opportunity
    await db.execute(
        delete(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == opportunity_id)
    )

    # 3. Delete the opportunity record
    await db.delete(opportunity)
    await db.commit()

    return {"message": "Opportunity deleted successfully", "id": str(opportunity_id)}

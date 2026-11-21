from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchStatus


async def create_opportunity(
    db: AsyncSession,
    project_id: UUID,
    title: str,
    description: str,
    required_skills: list[str],
    current_user_id: UUID | None = None,
) -> Opportunity:
    pitch = await db.get(Pitch, project_id)
    if pitch is None:
        raise ValueError("Pitch not found")
    if current_user_id is not None and pitch.author_id != current_user_id:
        raise PermissionError("Only the pitch owner can create opportunities")
    if pitch.status != PitchStatus.PUBLISHED:
        raise ValueError(
            "Cannot create an opportunity from a draft pitch. Please publish the pitch first."
        )

    # Enforce strictly one opportunity per pitch
    existing_opp = await db.execute(
        select(Opportunity.id).where(Opportunity.project_id == project_id)
    )
    if existing_opp.scalar_one_or_none() is not None:
        raise ValueError("An opportunity has already been created for this pitch")

    opportunity = Opportunity(
        project_id=project_id,
        title=title,
        description=description,
        required_skills=required_skills,
    )
    db.add(opportunity)
    await db.commit()
    await db.refresh(opportunity)

    return opportunity

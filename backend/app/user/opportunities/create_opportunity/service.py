from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch


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

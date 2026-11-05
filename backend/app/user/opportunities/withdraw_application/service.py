from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.user.opportunities.apply.models import Application


async def withdraw_application(
    db: AsyncSession,
    opportunity_id: UUID,
    user_id: UUID,
) -> None:
    statement = select(Application).where(
        Application.user_id == user_id,
        Application.opportunity_id == opportunity_id,
    )
    result = await db.execute(statement)
    application = result.scalar_one_or_none()

    if application is None:
        raise ValueError("Application not found")

    await db.delete(application)
    await db.commit()


from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.schemas import (
    OpportunityResponse,
)
from . import service

router = APIRouter(tags=["opportunities"])


@router.get(
    "/opportunities/{opportunity_id}",
    response_model=OpportunityResponse,
)
async def view_opportunity(
    opportunity_id: int = Path(ge=1),
    db: AsyncSession = Depends(get_db_session),
):
    opportunity = await service.view_opportunity(
        db=db,
        opportunity_id=opportunity_id,
    )

    if opportunity is None:
        raise HTTPException(
            status_code=404,
            detail="Opportunity not found",
        )

    return opportunity

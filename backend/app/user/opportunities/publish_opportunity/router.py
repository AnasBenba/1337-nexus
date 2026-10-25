from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.schemas import OpportunityResponse

from .service import publish_opportunity

router = APIRouter(tags=["opportunities"])


@router.post(
    "/opportunities/{opportunity_id}/publish",
    response_model=OpportunityResponse,
    status_code=status.HTTP_200_OK,
)
async def publish(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> OpportunityResponse:
    try:
        return await publish_opportunity(
            db=db,
            opportunity_id=opportunity_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
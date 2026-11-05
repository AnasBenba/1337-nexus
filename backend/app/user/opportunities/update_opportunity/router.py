from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.schemas import OpportunityResponse

from .schemas import UpdateOpportunityRequest
from .service import update_opportunity

router = APIRouter(tags=["opportunities"])


@router.patch(
    "/opportunities/{opportunity_id}",
    response_model=OpportunityResponse,
    status_code=status.HTTP_200_OK,
)
async def update(
    opportunity_id: UUID,
    request: UpdateOpportunityRequest,
    db: AsyncSession = Depends(get_db_session),
) -> OpportunityResponse:
    try:
        return await update_opportunity(
            db=db,
            opportunity_id=opportunity_id,
            title=request.title,
            description=request.description,
            required_skills=request.required_skills,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
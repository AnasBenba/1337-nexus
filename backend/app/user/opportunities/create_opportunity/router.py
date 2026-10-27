from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.schemas import OpportunityResponse

from .schemas import CreateOpportunityRequest
from .service import create_opportunity

router = APIRouter(tags=["opportunities"])


@router.post(
    "/opportunities/",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create(
    request: CreateOpportunityRequest,
    db: AsyncSession = Depends(get_db_session),
) -> OpportunityResponse:
    return await create_opportunity(
        db=db,
        project_id=request.project_id,
        title=request.title,
        description=request.description,
        required_skills=request.required_skills,
    )
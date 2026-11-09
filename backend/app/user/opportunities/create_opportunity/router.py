from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.schemas import OpportunityResponse
from app.user.pitches.models import Pitch

from .schemas import CreateOpportunityRequest
from .service import create_opportunity

router = APIRouter(tags=["opportunities"])


@router.post(
    "/opportunities/",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/opportunities",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@router.post(
    "/api/v1/opportunities/",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@router.post(
    "/api/v1/opportunities",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create(
    request: CreateOpportunityRequest,
    db: AsyncSession = Depends(get_db_session),
) -> OpportunityResponse:
    pitch = await db.get(Pitch, request.project_id)
    if pitch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pitch with id '{request.project_id}' not found.",
        )
    return await create_opportunity(
        db=db,
        project_id=request.project_id,
        title=request.title,
        description=request.description,
        required_skills=request.required_skills,
    )

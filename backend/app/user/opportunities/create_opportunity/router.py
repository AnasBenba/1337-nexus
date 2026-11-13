from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.schemas import OpportunityResponse
from app.oauth.user import Users
from app.user.dependencies import get_current_user

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
    current_user: Users = Depends(get_current_user),
) -> OpportunityResponse:
    try:
        return await create_opportunity(
            db=db,
            project_id=request.project_id,
            title=request.title,
            description=request.description,
            required_skills=request.required_skills,
            current_user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error

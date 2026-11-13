from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.schemas import OpportunityResponse
from app.oauth.user import Users
from app.oauth.dependencies import get_authenticated_user as get_current_user

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
    current_user: Users = Depends(get_current_user),
) -> OpportunityResponse:
    try:
        return await publish_opportunity(
            db=db,
            opportunity_id=opportunity_id,
            current_user_id=current_user.id,
        )
    except (ValueError, PermissionError) as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN if isinstance(error, PermissionError) else status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

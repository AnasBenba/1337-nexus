from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from .schemas import ApplyRequest, ApplyResponse
from .service import apply_to_opportunity

router = APIRouter(tags=["opportunities"])


@router.post(
    "/opportunities/{opportunity_id}/apply",
    response_model=ApplyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply(
    request: ApplyRequest,
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await apply_to_opportunity(
            db=db,
            opportunity_id=opportunity_id,
            user_id=request.user_id,
            message=request.message,
            candidate_skills=request.candidate_skills,
        )
    except ValueError as error:
        detail = str(error)
        error_status = (
            status.HTTP_404_NOT_FOUND
            if detail == "Opportunity not found"
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(status_code=error_status, detail=detail) from error
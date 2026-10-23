from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session

from .schemas import WithdrawApplicationRequest
from .service import withdraw_application

router = APIRouter(tags=["opportunities"])


@router.delete(
    "/opportunities/{opportunity_id}/apply",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def withdraw(
    request: WithdrawApplicationRequest,
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    try:
        await withdraw_application(
            db=db,
            opportunity_id=opportunity_id,
            user_id=request.user_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

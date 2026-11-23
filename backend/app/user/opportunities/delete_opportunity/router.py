from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.dependencies import get_current_user

from .service import delete_opportunity

router = APIRouter(tags=["opportunities"])


@router.delete(
    "/opportunities/{opportunity_id}",
    response_model=dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Delete an opportunity",
)
async def delete_opportunity_endpoint(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await delete_opportunity(
            db=db,
            opportunity_id=opportunity_id,
            current_user_id=current_user.id,
        )
    except (ValueError, PermissionError) as error:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
                if isinstance(error, PermissionError)
                else status.HTTP_404_NOT_FOUND
            ),
            detail=str(error),
        ) from error

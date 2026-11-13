from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.opportunities.browse_opportunities.schemas import (
    OpportunityResponse,
)

from . import service

router = APIRouter(tags=["opportunities"])


@router.get("/opportunities/my-projects")
@router.get(
    "/api/v1/opportunities/my-projects",
    include_in_schema=False,
)
async def get_my_projects(
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return await service.list_my_projects(db=db, current_user=current_user)


@router.get("/opportunities/{opportunity_id}/workspace")
@router.get(
    "/api/v1/opportunities/{opportunity_id}/workspace",
    include_in_schema=False,
)
async def get_workspace_for_opportunity(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await service.get_opportunity_workspace(
            db=db,
            opportunity_id=opportunity_id,
            current_user=current_user,
        )
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error


@router.get(
    "/opportunities/{opportunity_id}",
    response_model=OpportunityResponse,
)
@router.get(
    "/api/v1/opportunities/{opportunity_id}",
    response_model=OpportunityResponse,
    include_in_schema=False,
)
async def view_opportunity(
    opportunity_id: UUID,
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

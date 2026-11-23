from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.user.dependencies import get_current_user

from . import service
from .schemas import OpportunityResponse

router = APIRouter(tags=["opportunities"])


@router.get(
    "/opportunities/mine",
    response_model=list[OpportunityResponse],
)
async def get_my_opportunities(
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
):
    return await service.list_my_opportunities(
        db=db,
        owner_id=current_user.id,
    )


@router.get(
    "/opportunities/",
    response_model=list[OpportunityResponse],
)
async def browse_opportunities(
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    exclude_mine: bool = Query(default=False),
    db: AsyncSession = Depends(get_db_session),
):
    exclude_user_id = None
    if exclude_mine:
        try:
            user = await get_authenticated_user(request=request, db=db)
            exclude_user_id = user.id
        except HTTPException:
            exclude_user_id = None

    return await service.browse_opportunities(
        db=db,
        skip=skip,
        limit=limit,
        exclude_user_id=exclude_user_id,
    )

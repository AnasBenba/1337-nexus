from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from . import service
from .schemas import OpportunityResponse

router = APIRouter(tags=["opportunities"])


@router.get(
    "/opportunities/",
    response_model=list[OpportunityResponse],
)
async def browse_opportunities(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
):
    return await service.browse_opportunities(
        db=db,
        skip=skip,
        limit=limit,
    )
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session

from .schemas import MatchScoreResponse
from .service import score_opportunity_applications

router = APIRouter(tags=["opportunities"])


@router.get(
    "/opportunities/{opportunity_id}/applications/match-scoring",
    response_model=list[MatchScoreResponse],
)
async def match_score_applications(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> list[MatchScoreResponse]:
    try:
        scored_applications = await score_opportunity_applications(
            db=db,
            opportunity_id=opportunity_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    return [
        MatchScoreResponse.model_validate(application, from_attributes=True).model_copy(
            update={"match_score": score}
        )
        for application, score in scored_applications
    ]

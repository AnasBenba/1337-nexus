from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.opportunities.match_scoring.service import calculate_match_score

from .schemas import ReviewedApplicationResponse, UpdateApplicationStatusRequest
from .service import review_applications, update_application_status

router = APIRouter(tags=["opportunities"])


@router.get(
    "/opportunities/{opportunity_id}/applications",
    response_model=list[ReviewedApplicationResponse],
)
async def list_applications(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> list[ReviewedApplicationResponse]:
    try:
        applications = await score_opportunity_applications(
            db=db,
            opportunity_id=opportunity_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    return [
        ReviewedApplicationResponse.model_validate(
            application,
            from_attributes=True,
        ).model_copy(update={"match_score": score})
        for application, score in applications
    ]


@router.patch(
    "/applications/{application_id}/status",
    response_model=ReviewedApplicationResponse,
)
async def change_application_status(
    application_id: UUID,
    request: UpdateApplicationStatusRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ReviewedApplicationResponse:
    try:
        application = await update_application_status(
            db=db,
            application_id=application_id,
            new_status=request.status,
        )
    except ValueError as error:
        detail = str(error)
        error_status = (
            status.HTTP_404_NOT_FOUND
            if detail == "Application not found"
            else status.HTTP_409_CONFLICT
        )
        if detail == "Invalid application status":
            error_status = status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=error_status, detail=detail) from error

    opportunity = await db.get(Opportunity, application.opportunity_id)
    if opportunity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )

    score = calculate_match_score(
        opportunity.required_skills,
        application.candidate_skills,
    )
    return ReviewedApplicationResponse.model_validate(
        application,
        from_attributes=True,
    ).model_copy(update={"match_score": score})

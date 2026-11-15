from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.dependencies import get_current_user
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.opportunities.match_scoring.service import (
    calculate_match_score,
    score_opportunity_applications,
)
from app.user.pitches.models import Pitch

from app.user.opportunities.apply.models import Application
from .schemas import ReviewedApplicationResponse, UpdateApplicationStatusRequest
from .service import update_application_status

router = APIRouter(tags=["opportunities"])


def _reviewed_application_response(
    application: Application,
    match_score: float,
    applicant: Users | None = None,
) -> ReviewedApplicationResponse:
    return ReviewedApplicationResponse(
        id=application.id,
        opportunity_id=application.opportunity_id,
        user_id=application.user_id,
        applicant_login=applicant.login if applicant is not None else None,
        applicant_name=applicant.fullname if applicant is not None else None,
        status=application.status,
        message=application.message,
        candidate_skills=application.candidate_skills,
        match_score=match_score,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


@router.get(
    "/opportunities/{opportunity_id}/applications",
    response_model=list[ReviewedApplicationResponse],
)
async def list_applications(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[ReviewedApplicationResponse]:
    try:
        opportunity = await db.get(Opportunity, opportunity_id)
        if opportunity is None:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        pitch = await db.get(Pitch, opportunity.project_id)
        if pitch is None or pitch.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the pitch owner can review applications")
        applications = await score_opportunity_applications(
            db=db,
            opportunity_id=opportunity_id,
        )
    except (ValueError, PermissionError) as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    results: list[ReviewedApplicationResponse] = []
    for application, score in applications:
        applicant = await db.get(Users, application.user_id)
        results.append(_reviewed_application_response(application, score, applicant))
    return results


@router.patch(
    "/applications/{application_id}/status",
    response_model=ReviewedApplicationResponse,
)
async def change_application_status(
    application_id: UUID,
    request: UpdateApplicationStatusRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> ReviewedApplicationResponse:
    try:
        application = await update_application_status(
            db=db,
            application_id=application_id,
            new_status=request.status,
            current_user_id=current_user.id,
        )
    except (ValueError, PermissionError) as error:
        detail = str(error)
        error_status = (
            status.HTTP_404_NOT_FOUND
            if detail == "Application not found"
            else status.HTTP_409_CONFLICT
        )
        if isinstance(error, PermissionError):
            error_status = status.HTTP_403_FORBIDDEN
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
    applicant = await db.get(Users, application.user_id)
    return _reviewed_application_response(application, score, applicant)

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.projects.schemas import ProjectResponse
from app.user.quick_actions.service import (
    continue_project,
    find_team,
    quick_create_project,
)
from app.user.dependencies import get_current_user
from app.oauth.user import Users

router = APIRouter(prefix="/quick-actions", tags=["quick-actions"])


class CreateProjectRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)


@router.post(
    "/create-project",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_action(
    request: CreateProjectRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> ProjectResponse:
    project = await quick_create_project(
        db,
        owner_id=current_user.id,
        title=request.title,
        description=request.description,
    )
    return ProjectResponse.model_validate(project)


@router.get("/find-team")
async def find_team_action(
    opportunity_id: UUID = Query(),
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> object | None:
    team = await find_team(db, opportunity_id=opportunity_id)
    return team


@router.get("/continue-project")
async def continue_project_action(
    project_id: UUID = Query(),
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> ProjectResponse | None:
    project = await continue_project(db, project_id=project_id)
    if project is None or project.owner_id != current_user.id:
        return None
    return ProjectResponse.model_validate(project)

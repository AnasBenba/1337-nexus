from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.projects.models import Project
from app.user.projects.schemas import ProjectRequest, ProjectResponse
from app.user.projects.service import create_project
from app.oauth.dependencies import get_authenticated_user as get_current_user
from app.oauth.user import Users

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create(
    request: ProjectRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> Project:
    return await create_project(
        db, owner_id=current_user.id, title=request.title, description=request.description
    )

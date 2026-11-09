from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.projects.models import Project
from app.user.projects.schemas import ProjectResponse, ProjectUpdateRequest
from app.user.projects.service import update_project
from app.user.dependencies import get_current_user
from app.oauth.user import Users

router = APIRouter(prefix="/projects", tags=["projects"])


@router.patch("/{project_id}", response_model=ProjectResponse)
async def edit(
    project_id: UUID,
    request: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> Project:
    try:
        return await update_project(
            db,
            project_id=project_id,
            owner_id=current_user.id,
            title=request.title,
            description=request.description,
        )
    except PermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error

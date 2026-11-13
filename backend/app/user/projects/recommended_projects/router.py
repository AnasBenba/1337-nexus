from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.projects.models import Project
from app.user.projects.schemas import ProjectResponse
from app.user.projects.service import list_recommended_projects
from app.oauth.dependencies import get_authenticated_user as get_current_user
from app.oauth.user import Users

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/recommended", response_model=list[ProjectResponse])
async def recommended(
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> list[Project]:
    return await list_recommended_projects(db, exclude_owner_id=current_user.id)

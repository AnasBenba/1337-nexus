from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.projects.models import Project

from .membership import accept_member, invite_member, remove_member
from .provision_workspace.service import provision_workspace
from .models import WorkspaceTeam
from app.oauth.user import Users
from app.user.dependencies import get_current_user

router = APIRouter(prefix="/teams", tags=["teams"])


class InviteRequest(BaseModel):
    user_id: UUID


class CreateTeamRequest(BaseModel):
    opportunity_id: UUID


class AcceptRequest(BaseModel):
    pass


class RemoveRequest(BaseModel):
    user_id: UUID


class MemberResponse(BaseModel):
    id: UUID
    team_id: UUID
    user_id: UUID
    status: str

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    id: UUID
    opportunity_id: UUID
    founder_id: UUID

    model_config = {"from_attributes": True}


def _team_error(error: ValueError | PermissionError) -> HTTPException:
    code = (
        status.HTTP_403_FORBIDDEN
        if isinstance(error, PermissionError)
        else status.HTTP_409_CONFLICT
    )
    return HTTPException(status_code=code, detail=str(error))


@router.post("", response_model=TeamResponse, status_code=201)
async def create(
    request: CreateTeamRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> WorkspaceTeam:
    try:
        opportunity = await db.get(Opportunity, request.opportunity_id)
        project = (
            await db.get(Project, opportunity.project_id)
            if opportunity is not None
            else None
        )
        if project is None:
            raise ValueError("Opportunity not found")
        if project.owner_id != current_user.id:
            raise PermissionError("Only the project owner can create a team")
        result = await provision_workspace(
            db,
            opportunity_id=request.opportunity_id,
            founder_id=current_user.id,
        )
        await db.commit()
        return result.team
    except (ValueError, PermissionError) as error:
        await db.rollback()
        raise _team_error(error) from error


@router.post("/{team_id}/members/invite", response_model=MemberResponse, status_code=201)
async def invite(
    team_id: UUID,
    request: InviteRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> MemberResponse:
    try:
        return await invite_member(
            db, team_id=team_id, inviter_id=current_user.id, user_id=request.user_id
        )
    except (ValueError, PermissionError) as error:
        raise _team_error(error) from error


@router.post("/{team_id}/members/accept", response_model=MemberResponse)
async def accept(
    team_id: UUID,
    request: AcceptRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> MemberResponse:
    try:
        return await accept_member(db, team_id=team_id, user_id=current_user.id)
    except (ValueError, PermissionError) as error:
        raise _team_error(error) from error


@router.delete("/{team_id}/members", status_code=status.HTTP_204_NO_CONTENT)
async def remove(
    team_id: UUID,
    request: RemoveRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> None:
    try:
        await remove_member(
            db,
            team_id=team_id,
            remover_id=current_user.id,
            user_id=request.user_id,
        )
    except (ValueError, PermissionError) as error:
        raise _team_error(error) from error

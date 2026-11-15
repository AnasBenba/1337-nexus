from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collaboration.canvas.join_canvas.service import get_or_create_document
from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.user.dependencies import get_current_user
from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch
from app.user.pitches.service import get_one_pitch

from .membership import accept_member, invite_member, remove_member
from .models import WorkspaceTeam, WorkspaceTeamMember
from .provision_workspace.service import (
    provision_workspace,
    provision_workspace_for_pitch,
)

router = APIRouter(tags=["teams"])


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
    opportunity_id: UUID | None = None
    pitch_id: UUID | None = None
    founder_id: UUID

    model_config = {"from_attributes": True}


class TeamWorkspaceResponse(BaseModel):
    team_id: UUID
    pitch_id: UUID
    role: str


class OpportunityWorkspaceResponse(BaseModel):
    team_id: UUID
    opportunity_id: UUID
    opportunity_title: str
    pitch_id: UUID
    pitch_title: str
    document_id: UUID
    board_id: UUID
    channel_id: UUID
    role: str


class TeamMemberRequest(BaseModel):
    user_id: UUID


class TeamMemberResponse(BaseModel):
    team_id: UUID
    user_id: UUID
    role: str


class TeamUserResponse(BaseModel):
    id: UUID
    login: str
    fullname: str


def _team_error(error: ValueError | PermissionError) -> HTTPException:
    code = (
        status.HTTP_403_FORBIDDEN
        if isinstance(error, PermissionError)
        else status.HTTP_409_CONFLICT
    )
    return HTTPException(status_code=code, detail=str(error))


async def _resolve_team_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Users:
    try:
        return await get_authenticated_user(request=request, db=db)
    except HTTPException:
        return await get_current_user(request=request, db=db)


async def require_team_admin(
    db: AsyncSession,
    team_id: UUID,
    current_user: Users,
) -> WorkspaceTeam:
    team = await db.get(WorkspaceTeam, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    membership = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team_id,
            WorkspaceTeamMember.user_id == current_user.id,
        )
    )
    if membership is None or (membership.role != "admin" and team.founder_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team admins can manage members",
        )
    return team


@router.post("/teams", response_model=TeamResponse, status_code=201)
async def create(
    request: CreateTeamRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> WorkspaceTeam:
    try:
        opportunity = await db.get(Opportunity, request.opportunity_id)
        pitch = (
            await db.get(Pitch, opportunity.project_id)
            if opportunity is not None
            else None
        )
        if pitch is None:
            raise ValueError("Opportunity not found")
        if pitch.author_id != current_user.id:
            raise PermissionError("Only the pitch owner can create a team")
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


@router.post("/teams/{team_id}/members/invite", response_model=MemberResponse, status_code=201)
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


@router.post("/teams/{team_id}/members/accept", response_model=MemberResponse)
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


@router.delete("/teams/{team_id}/members", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get(
    "/api/v1/teams/{team_id}/available-members",
    response_model=list[TeamUserResponse],
)
async def list_available_team_members(
    team_id: UUID,
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(_resolve_team_user),
) -> list[TeamUserResponse]:
    await require_team_admin(db, team_id, current_user)

    statement = select(Users).where(
        Users.id.not_in(
            select(WorkspaceTeamMember.user_id).where(
                WorkspaceTeamMember.team_id == team_id,
            )
        )
    )
    normalized_search = search.strip() if search else ""
    if normalized_search:
        search_pattern = f"%{normalized_search}%"
        statement = statement.where(
            Users.login.ilike(search_pattern) | Users.fullname.ilike(search_pattern)
        )
    result = await db.scalars(
        statement.order_by(Users.fullname, Users.login).limit(100)
    )
    return [
        TeamUserResponse(id=user.id, login=user.login, fullname=user.fullname)
        for user in result.all()
    ]


@router.post(
    "/api/v1/teams/pitches/{pitch_id}/workspace",
    response_model=TeamWorkspaceResponse,
    status_code=status.HTTP_200_OK,
)
async def create_or_get_pitch_workspace(
    pitch_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(_resolve_team_user),
) -> TeamWorkspaceResponse:
    pitch = await get_one_pitch(db, pitch_id)
    if pitch.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the pitch owner can create its team workspace",
        )

    try:
        workspace = await provision_workspace_for_pitch(db, pitch)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    membership = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == workspace.team.id,
            WorkspaceTeamMember.user_id == current_user.id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Pitch workspace was created without its owner membership",
        )
    return TeamWorkspaceResponse(
        team_id=workspace.team.id,
        pitch_id=pitch.id,
        role=membership.role,
    )


@router.post(
    "/teams/opportunities/{opportunity_id}/workspace",
    response_model=OpportunityWorkspaceResponse,
    status_code=status.HTTP_200_OK,
)
@router.post(
    "/api/v1/teams/opportunities/{opportunity_id}/workspace",
    response_model=OpportunityWorkspaceResponse,
    status_code=status.HTTP_200_OK,
)
async def create_or_get_opportunity_workspace(
    opportunity_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(_resolve_team_user),
) -> OpportunityWorkspaceResponse:
    opportunity = await db.get(Opportunity, opportunity_id)
    if opportunity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found",
        )

    pitch = await db.get(Pitch, opportunity.project_id)
    founder_id = (
        pitch.author_id
        if pitch is not None and pitch.author_id is not None
        else current_user.id
    )

    is_owner = current_user.id == founder_id
    accepted_app = await db.scalar(
        select(Application).where(
            Application.opportunity_id == opportunity_id,
            Application.user_id == current_user.id,
            Application.status == "accepted",
        )
    )
    existing_team = await db.scalar(
        select(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == opportunity_id)
    )
    existing_member = None
    if existing_team is not None:
        existing_member = await db.scalar(
            select(WorkspaceTeamMember).where(
                WorkspaceTeamMember.team_id == existing_team.id,
                WorkspaceTeamMember.user_id == current_user.id,
                WorkspaceTeamMember.status == "active",
            )
        )

    if not is_owner and accepted_app is None and existing_member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opportunity owner or accepted team members can access this workspace",
        )

    try:
        workspace = await provision_workspace(
            db,
            opportunity_id=opportunity.id,
            founder_id=founder_id,
        )
        membership = await db.scalar(
            select(WorkspaceTeamMember).where(
                WorkspaceTeamMember.team_id == workspace.team.id,
                WorkspaceTeamMember.user_id == current_user.id,
            )
        )
        if membership is None:
            membership = WorkspaceTeamMember(
                team_id=workspace.team.id,
                user_id=current_user.id,
                status="active",
                role="admin" if is_owner else "member",
            )
            db.add(membership)
        elif membership.status != "active":
            membership.status = "active"

        await get_or_create_document(
            db,
            document_id=workspace.canvas.id,
            name=f"{opportunity.title} Whiteboard",
        )
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return OpportunityWorkspaceResponse(
        team_id=workspace.team.id,
        opportunity_id=opportunity.id,
        opportunity_title=opportunity.title,
        pitch_id=opportunity.project_id,
        pitch_title=pitch.title if pitch is not None else "Untitled Pitch",
        document_id=workspace.canvas.id,
        board_id=workspace.board.id,
        channel_id=workspace.channel.id,
        role=membership.role,
    )


@router.post(
    "/api/v1/teams/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: UUID,
    request: TeamMemberRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(_resolve_team_user),
) -> TeamMemberResponse:
    await require_team_admin(db, team_id, current_user)

    user = await db.get(Users, request.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    membership = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team_id,
            WorkspaceTeamMember.user_id == request.user_id,
        )
    )
    if membership is None:
        membership = WorkspaceTeamMember(
            team_id=team_id,
            user_id=request.user_id,
            status="active",
            role="member",
        )
        db.add(membership)
        await db.commit()
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a team member",
        )

    return TeamMemberResponse(
        team_id=team_id,
        user_id=request.user_id,
        role=membership.role,
    )


@router.delete(
    "/api/v1/teams/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(_resolve_team_user),
) -> None:
    team = await require_team_admin(db, team_id, current_user)

    if user_id == team.founder_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The pitch owner cannot be removed from their team",
        )

    membership = await db.scalar(
        select(WorkspaceTeamMember).where(
            WorkspaceTeamMember.team_id == team_id,
            WorkspaceTeamMember.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found",
        )

    if membership.role == "admin":
        admin_count = await db.scalar(
            select(func.count())
            .select_from(WorkspaceTeamMember)
            .where(
                WorkspaceTeamMember.team_id == team_id,
                WorkspaceTeamMember.role == "admin",
            )
        )
        if admin_count is not None and admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A team must retain at least one admin",
            )

    await db.delete(membership)
    await db.commit()

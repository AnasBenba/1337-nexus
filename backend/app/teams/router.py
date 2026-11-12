from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.dependencies import get_authenticated_user
from app.oauth.user import Users
from app.user.pitches.service import get_one_pitch

from .models import WorkspaceTeam, WorkspaceTeamMember
from .provision_workspace.service import provision_workspace_for_pitch

router = APIRouter(prefix="/api/v1/teams", tags=["Teams"])


class TeamWorkspaceResponse(BaseModel):
    team_id: UUID
    pitch_id: UUID
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

    membership = await db.get(
        WorkspaceTeamMember,
        (team_id, current_user.id),
    )
    if membership is None or membership.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team admins can manage members",
        )
    return team


@router.get(
    "/{team_id}/available-members",
    response_model=list[TeamUserResponse],
)
async def list_available_team_members(
    team_id: UUID,
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_authenticated_user),
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
    "/pitches/{pitch_id}/workspace",
    response_model=TeamWorkspaceResponse,
    status_code=status.HTTP_200_OK,
)
async def create_or_get_pitch_workspace(
    pitch_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_authenticated_user),
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

    membership = await db.get(
        WorkspaceTeamMember,
        (workspace.team.id, current_user.id),
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
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_team_member(
    team_id: UUID,
    request: TeamMemberRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_authenticated_user),
) -> TeamMemberResponse:
    await require_team_admin(db, team_id, current_user)

    user = await db.get(Users, request.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    membership = await db.get(
        WorkspaceTeamMember,
        (team_id, request.user_id),
    )
    if membership is None:
        membership = WorkspaceTeamMember(
            team_id=team_id,
            user_id=request.user_id,
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
    "/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_member(
    team_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_authenticated_user),
) -> None:
    team = await require_team_admin(db, team_id, current_user)

    if user_id == team.founder_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The pitch owner cannot be removed from their team",
        )

    membership = await db.get(WorkspaceTeamMember, (team_id, user_id))
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

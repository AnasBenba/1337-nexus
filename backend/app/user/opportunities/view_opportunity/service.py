from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.oauth.user import Users
from app.teams.models import WorkspaceTeam, WorkspaceTeamMember
from app.teams.provision_workspace.service import (
    ensure_canvas_document,
    ensure_workspace_member,
    provision_workspace,
)
from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch


async def view_opportunity(
    db: AsyncSession,
    opportunity_id: UUID,
) -> Opportunity | None:
    statement = select(Opportunity).where(Opportunity.id == opportunity_id)
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def list_my_projects(
    db: AsyncSession,
    current_user: Users,
) -> list[dict[str, Any]]:
    # 1. Fetch pitches authored by current_user
    owned_pitches_res = await db.execute(select(Pitch).where(Pitch.author_id == current_user.id))
    owned_pitches = {p.id: p for p in owned_pitches_res.scalars().all()}

    # 2. Fetch accepted applications for current_user
    accepted_apps_res = await db.execute(
        select(Application).where(
            Application.user_id == current_user.id,
            Application.status == "accepted",
        )
    )
    accepted_opp_ids = {app.opportunity_id for app in accepted_apps_res.scalars().all()}

    # 3. Also check workspace_teams / workspace_team_members for current_user
    team_res = await db.execute(
        select(WorkspaceTeam).where(WorkspaceTeam.founder_id == current_user.id)
    )
    founder_opp_ids = {t.opportunity_id for t in team_res.scalars().all()}

    member_teams_res = await db.execute(
        select(WorkspaceTeam.opportunity_id)
        .join(WorkspaceTeamMember, WorkspaceTeamMember.team_id == WorkspaceTeam.id)
        .where(
            WorkspaceTeamMember.user_id == current_user.id,
            WorkspaceTeamMember.status == "accepted",
        )
    )
    member_opp_ids = set(member_teams_res.scalars().all())

    # 4. Fetch all opportunities matching any of those conditions
    all_opps_res = await db.execute(select(Opportunity).order_by(Opportunity.created_at.desc()))
    all_opps = all_opps_res.scalars().all()

    authorized_opps: list[Opportunity] = []
    for opp in all_opps:
        if (
            opp.project_id in owned_pitches
            or opp.id in accepted_opp_ids
            or opp.id in founder_opp_ids
            or opp.id in member_opp_ids
        ):
            authorized_opps.append(opp)

    if not authorized_opps:
        return []

    # Preload related pitches and applications for counts
    pitch_ids = {opp.project_id for opp in authorized_opps}
    pitches_res = await db.execute(select(Pitch).where(Pitch.id.in_(pitch_ids)))
    pitches_by_id = {p.id: p for p in pitches_res.scalars().all()}

    opp_ids = {opp.id for opp in authorized_opps}
    apps_res = await db.execute(select(Application).where(Application.opportunity_id.in_(opp_ids)))
    apps_by_opp: dict[UUID, list[Application]] = {oid: [] for oid in opp_ids}
    for app in apps_res.scalars().all():
        apps_by_opp.setdefault(app.opportunity_id, []).append(app)

    items: list[dict[str, Any]] = []
    for opp in authorized_opps:
        pitch = pitches_by_id.get(opp.project_id)
        owner_id = pitch.author_id if pitch else None
        is_owner = (owner_id == current_user.id) or (opp.id in founder_opp_ids and owner_id is None)
        opp_apps = apps_by_opp.get(opp.id, [])
        accepted_count = sum(1 for a in opp_apps if a.status == "accepted")
        pending_count = sum(1 for a in opp_apps if a.status in ("pending", "under_review"))

        items.append(
            {
                "id": opp.id,
                "project_id": opp.project_id,
                "title": opp.title,
                "description": opp.description,
                "required_skills": opp.required_skills or [],
                "status": opp.status,
                "my_role": "owner" if is_owner else "member",
                "owner_id": owner_id,
                "pitch_title": pitch.title if pitch else None,
                "pitch_category": (
                    pitch.category.value
                    if pitch and hasattr(pitch.category, "value")
                    else (str(pitch.category) if pitch else None)
                ),
                "member_count": 1 + accepted_count,
                "pending_applications_count": pending_count,
                "created_at": opp.created_at,
                "updated_at": opp.updated_at,
            }
        )

    return items


async def get_opportunity_workspace(
    db: AsyncSession,
    *,
    opportunity_id: UUID,
    current_user: Users,
) -> dict[str, Any]:
    opportunity = await db.get(Opportunity, opportunity_id)
    if opportunity is None:
        raise LookupError("Opportunity not found")

    pitch = await db.get(Pitch, opportunity.project_id)
    owner_id = pitch.author_id if pitch and pitch.author_id else None

    # Fetch all applications for this opportunity
    apps_res = await db.execute(
        select(Application).where(Application.opportunity_id == opportunity_id)
    )
    applications = list(apps_res.scalars().all())
    accepted_apps = [a for a in applications if a.status == "accepted"]
    accepted_user_ids = {a.user_id for a in accepted_apps}

    # Check if user is in workspace_team_members or founder
    existing_team = await db.scalar(
        select(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == opportunity_id)
    )
    is_team_member = False
    if existing_team is not None:
        if existing_team.founder_id == current_user.id:
            is_team_member = True
        else:
            wm = await db.scalar(
                select(WorkspaceTeamMember).where(
                    WorkspaceTeamMember.team_id == existing_team.id,
                    WorkspaceTeamMember.user_id == current_user.id,
                    WorkspaceTeamMember.status == "accepted",
                )
            )
            is_team_member = wm is not None

    is_owner = (owner_id == current_user.id) or (
        existing_team is not None
        and existing_team.founder_id == current_user.id
        and owner_id is None
    )
    is_authorized = (
        is_owner
        or (current_user.id in accepted_user_ids)
        or is_team_member
        or (current_user.role == "admin")
    )

    if not is_authorized:
        raise PermissionError("You are not authorized to access this project workspace")

    effective_founder_id = owner_id or (
        existing_team.founder_id if existing_team else current_user.id
    )

    # Idempotently provision workspace + canvas document + members
    provisioned = await provision_workspace(
        db,
        opportunity_id=opportunity.id,
        founder_id=effective_founder_id,
    )
    await ensure_canvas_document(
        db,
        canvas_id=provisioned.canvas.id,
        name=opportunity.title,
    )
    await ensure_workspace_member(
        db,
        team_id=provisioned.team.id,
        user_id=effective_founder_id,
        role="admin",
    )
    for acc_uid in accepted_user_ids:
        await ensure_workspace_member(
            db,
            team_id=provisioned.team.id,
            user_id=acc_uid,
            role="member",
        )
    await db.commit()

    # Build participating members roster
    member_user_ids: list[UUID] = [effective_founder_id]
    skills_by_user: dict[UUID, list[str]] = {}
    for app in accepted_apps:
        skills_by_user[app.user_id] = app.candidate_skills or []
        if app.user_id not in member_user_ids:
            member_user_ids.append(app.user_id)

    wm_rows = (
        (
            await db.execute(
                select(WorkspaceTeamMember).where(
                    WorkspaceTeamMember.team_id == provisioned.team.id,
                    WorkspaceTeamMember.status == "accepted",
                )
            )
        )
        .scalars()
        .all()
    )
    for wm_row in wm_rows:
        if wm_row.user_id not in member_user_ids:
            member_user_ids.append(wm_row.user_id)

    users_res = await db.execute(select(Users).where(Users.id.in_(member_user_ids)))
    users_by_id = {u.id: u for u in users_res.scalars().all()}

    members_payload: list[dict[str, Any]] = []
    for uid in member_user_ids:
        u = users_by_id.get(uid)
        role_label = "owner" if uid == effective_founder_id else "member"
        members_payload.append(
            {
                "id": str(uid),
                "login": u.login if u else f"user_{str(uid)[:6]}",
                "fullname": u.fullname if u else f"Teammate {str(uid)[:6]}",
                "email": u.email if u else None,
                "avatar_url": u.avatar_url if u else None,
                "role": role_label,
                "skills": skills_by_user.get(uid, []),
            }
        )

    pitch_payload = None
    if pitch is not None:
        pitch_payload = {
            "id": str(pitch.id),
            "title": pitch.title,
            "description": pitch.description,
            "content": pitch.content,
            "category": (
                pitch.category.value if hasattr(pitch.category, "value") else str(pitch.category)
            ),
            "status": (pitch.status.value if hasattr(pitch.status, "value") else str(pitch.status)),
            "author_id": str(pitch.author_id) if pitch.author_id else None,
        }

    return {
        "opportunity": {
            "id": str(opportunity.id),
            "project_id": str(opportunity.project_id),
            "title": opportunity.title,
            "description": opportunity.description,
            "required_skills": opportunity.required_skills or [],
            "status": opportunity.status,
            "owner_id": str(effective_founder_id),
            "my_role": "owner" if is_owner else "member",
            "created_at": opportunity.created_at.isoformat() if opportunity.created_at else None,
            "updated_at": opportunity.updated_at.isoformat() if opportunity.updated_at else None,
        },
        "pitch": pitch_payload,
        "workspace": {
            "team_id": str(provisioned.team.id),
            "board_id": str(provisioned.board.id),
            "canvas_document_id": str(provisioned.canvas.id),
            "channel_id": str(provisioned.channel.id),
        },
        "members": members_payload,
    }

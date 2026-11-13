from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.collaboration.chat.models import Message
from app.core.config import get_settings
from app.core.db import get_db_session
from app.main import fastapi_app
from app.oauth.jwt import create_access_token
from app.oauth.user import Users
from app.realtime.namespaces.chat import ChatNamespace
from app.teams.models import WorkspaceTeam
from app.user.opportunities.apply.models import Application
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch, PitchVote


@pytest.fixture
def engine():
    settings = get_settings()
    return create_async_engine(settings.async_database_url, poolclass=NullPool)


@pytest.mark.asyncio
async def test_unified_pitches_voting_my_projects_and_workspace(engine) -> None:
    async def override_get_db():
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    fastapi_app.dependency_overrides[get_db_session] = override_get_db

    owner_id = uuid.uuid4()
    member_id = uuid.uuid4()
    outsider_id = uuid.uuid4()

    owner_login = f"owner_{owner_id.hex[:6]}"
    member_login = f"member_{member_id.hex[:6]}"
    outsider_login = f"out_{outsider_id.hex[:6]}"

    pitch_id: uuid.UUID | None = None
    opp_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None

    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            owner = Users(
                id=owner_id,
                login=owner_login,
                email=f"{owner_login}@1337.ma",
                fullname="Owner Student",
                role="user",
            )
            member = Users(
                id=member_id,
                login=member_login,
                email=f"{member_login}@1337.ma",
                fullname="Accepted Member",
                role="user",
            )
            outsider = Users(
                id=outsider_id,
                login=outsider_login,
                email=f"{outsider_login}@1337.ma",
                fullname="Outsider User",
                role="user",
            )
            session.add_all([owner, member, outsider])
            await session.commit()

        owner_token = create_access_token(owner_id, role="user")
        member_token = create_access_token(member_id, role="user")
        outsider_token = create_access_token(outsider_id, role="user")

        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Check /api/v1/auth/session
            unauth_sess = await client.get("/api/v1/auth/session")
            assert unauth_sess.status_code == 200
            assert unauth_sess.json()["signed_in"] is False

            auth_sess = await client.get(
                "/api/v1/auth/session",
                cookies={"access_token": owner_token},
            )
            assert auth_sess.status_code == 200
            assert auth_sess.json()["signed_in"] is True
            assert auth_sess.json()["user"]["id"] == str(owner_id)

            # 2. Owner creates a Pitch
            create_pitch_res = await client.post(
                "/api/v1/user/pitches",
                json={
                    "title": "Unified Campus Robotics",
                    "description": "Autonomous rover navigation stack",
                    "content": "Problem: Manual rover calibration is slow.\nSolution: SLAM + ROS2.",
                    "category": "Technology",
                },
                cookies={"access_token": owner_token},
            )
            assert create_pitch_res.status_code == 201
            pitch_data = create_pitch_res.json()
            pitch_id = uuid.UUID(pitch_data["id"])
            assert pitch_data["upvotes"] == 0
            assert pitch_data["downvotes"] == 0
            assert pitch_data["score"] == 0

            # 3. Member upvotes, Outsider downvotes, Owner publishes
            up_res = await client.post(
                f"/api/v1/user/pitches/{pitch_id}/vote",
                json={"direction": "up"},
                cookies={"access_token": member_token},
            )
            assert up_res.status_code == 200
            assert up_res.json()["upvotes"] == 1
            assert up_res.json()["score"] == 1
            assert up_res.json()["my_vote"] == "up"

            down_res = await client.post(
                f"/api/v1/user/pitches/{pitch_id}/vote",
                json={"direction": "down"},
                cookies={"access_token": outsider_token},
            )
            assert down_res.status_code == 200
            assert down_res.json()["upvotes"] == 1
            assert down_res.json()["downvotes"] == 1
            assert down_res.json()["score"] == 0

            del_vote_res = await client.delete(
                f"/api/v1/user/pitches/{pitch_id}/vote",
                cookies={"access_token": outsider_token},
            )
            assert del_vote_res.status_code == 200
            assert del_vote_res.json()["score"] == 1

            pub_res = await client.post(
                f"/api/v1/user/pitches/{pitch_id}/publish",
                cookies={"access_token": owner_token},
            )
            assert pub_res.status_code == 200
            assert pub_res.json()["status"] == "published"

            # 4. Create & Publish an Opportunity linked to this Pitch
            opp_res = await client.post(
                "/api/v1/opportunities",
                json={
                    "project_id": str(pitch_id),
                    "title": "ROS2 Navigation Engineer",
                    "description": "Implement path planning and sensor fusion",
                    "required_skills": ["ROS2", "Python", "C++"],
                },
                cookies={"access_token": owner_token},
            )
            assert opp_res.status_code == 201
            opp_id = uuid.UUID(opp_res.json()["id"])

            await client.post(
                f"/api/v1/opportunities/{opp_id}/publish",
                cookies={"access_token": owner_token},
            )

            # 5. Member applies and Owner accepts
            apply_res = await client.post(
                f"/api/v1/opportunities/{opp_id}/apply",
                json={
                    "user_id": str(member_id),
                    "message": "Experienced with ROS2 Nav2",
                    "candidate_skills": ["ROS2", "Python"],
                },
                cookies={"access_token": member_token},
            )
            assert apply_res.status_code == 201
            app_id = apply_res.json()["id"]

            accept_res = await client.patch(
                f"/api/v1/applications/{app_id}/status",
                json={"status": "accepted"},
                cookies={"access_token": owner_token},
            )
            assert accept_res.status_code == 200

            # 6. Check /api/v1/opportunities/my-projects for Owner, Member, and Outsider
            owner_projects = await client.get(
                "/api/v1/opportunities/my-projects",
                cookies={"access_token": owner_token},
            )
            assert owner_projects.status_code == 200
            assert any(
                p["id"] == str(opp_id) and p["my_role"] == "owner" for p in owner_projects.json()
            )

            member_projects = await client.get(
                "/api/v1/opportunities/my-projects",
                cookies={"access_token": member_token},
            )
            assert member_projects.status_code == 200
            assert any(
                p["id"] == str(opp_id) and p["my_role"] == "member" for p in member_projects.json()
            )

            outsider_projects = await client.get(
                "/api/v1/opportunities/my-projects",
                cookies={"access_token": outsider_token},
            )
            assert outsider_projects.status_code == 200
            assert not any(p["id"] == str(opp_id) for p in outsider_projects.json())

            # 7. Check /api/v1/opportunities/{opp_id}/workspace authorization & bundle
            outsider_ws = await client.get(
                f"/api/v1/opportunities/{opp_id}/workspace",
                cookies={"access_token": outsider_token},
            )
            assert outsider_ws.status_code == 403

            member_ws = await client.get(
                f"/api/v1/opportunities/{opp_id}/workspace",
                cookies={"access_token": member_token},
            )
            assert member_ws.status_code == 200
            ws_bundle = member_ws.json()
            team_id = uuid.UUID(ws_bundle["workspace"]["team_id"])
            member_ids_in_roster = {m["id"] for m in ws_bundle["members"]}
            assert str(owner_id) in member_ids_in_roster
            assert str(member_id) in member_ids_in_roster

            # 8. Test ChatNamespace team presence & team message persistence
            ns = ChatNamespace("/chat")
            ns.enter_room = AsyncMock()
            ns.leave_room = AsyncMock()
            ns.emit = AsyncMock()
            ns.get_session = AsyncMock(
                return_value={
                    "user_id": member_id,
                    "login": member_login,
                    "fullname": "Accepted Member",
                }
            )

            join_res = await ns.on_join_team("sid_member", {"team_id": str(team_id)})
            assert join_res["status"] == "ok"
            assert str(member_id) in join_res["online_user_ids"]

            msg_res = await ns.on_send_team_message(
                "sid_member",
                {"team_id": str(team_id), "content": "Hello team from workspace sidebar!"},
            )
            assert msg_res["status"] == "ok"
            assert msg_res["message"]["content"] == "Hello team from workspace sidebar!"

            hist_res = await client.get(
                f"/api/v1/messages/team/{team_id}",
                cookies={"access_token": owner_token},
            )
            assert hist_res.status_code == 200
            hist_list = hist_res.json()
            assert len(hist_list) == 1
            assert hist_list[0]["content"] == "Hello team from workspace sidebar!"
            assert hist_list[0]["sender_login"] == member_login

    finally:
        fastapi_app.dependency_overrides.pop(get_db_session, None)
        async with AsyncSession(engine, expire_on_commit=False) as cleanup:
            if team_id:
                await cleanup.execute(delete(Message).where(Message.team_id == team_id))
                await cleanup.execute(delete(WorkspaceTeam).where(WorkspaceTeam.id == team_id))
            if opp_id:
                await cleanup.execute(
                    delete(Application).where(Application.opportunity_id == opp_id)
                )
                await cleanup.execute(delete(Opportunity).where(Opportunity.id == opp_id))
            if pitch_id:
                await cleanup.execute(delete(PitchVote).where(PitchVote.pitch_id == pitch_id))
                await cleanup.execute(delete(Pitch).where(Pitch.id == pitch_id))
            await cleanup.execute(
                delete(Users).where(Users.id.in_([owner_id, member_id, outsider_id]))
            )
            await cleanup.commit()

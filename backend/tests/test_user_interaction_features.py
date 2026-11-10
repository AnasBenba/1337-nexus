from __future__ import annotations

import uuid
from typing import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.collaboration.chat.models import Message
from app.core.config import get_settings
from app.core.db import get_db_session
from app.main import create_app
from app.oauth.jwt import create_access_token
from app.oauth.user import Users
from app.user.friends.models import Friendship
from app.user.pitches.models import Pitch
from app.user.projects.models import Project


@pytest_asyncio.fixture
async def db() -> AsyncIterator[AsyncSession]:
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
        await session.execute(text("DELETE FROM users WHERE login LIKE 'student%'"))
        await session.commit()
    await engine.dispose()


@pytest_asyncio.fixture
async def sample_users(db: AsyncSession) -> tuple[Users, Users, Users]:
    """Create three test users with UUID IDs."""
    u1 = Users(
        id=uuid.uuid4(),
        login=f"student1_{uuid.uuid4().hex[:6]}",
        fullname="Student One",
        role="user",
        bio="Fullstack 42 student",
        campus="1337 Benguerir",
        intra_id=int(uuid.uuid4().int % 1000000),
    )
    u2 = Users(
        id=uuid.uuid4(),
        login=f"student2_{uuid.uuid4().hex[:6]}",
        fullname="Student Two",
        role="user",
        bio="AI Engineer at 1337",
        campus="1337 Khouribga",
        intra_id=int(uuid.uuid4().int % 1000000),
    )
    u3 = Users(
        id=uuid.uuid4(),
        login=f"student3_{uuid.uuid4().hex[:6]}",
        fullname="Student Three",
        role="user",
        bio="Kernel Hacker",
        campus="1337 Med",
        intra_id=int(uuid.uuid4().int % 1000000),
    )
    db.add_all([u1, u2, u3])
    await db.commit()
    await db.refresh(u1)
    await db.refresh(u2)
    await db.refresh(u3)
    return u1, u2, u3


def make_client(app, db: AsyncSession, user: Users) -> httpx.AsyncClient:
    async def override_db() -> AsyncIterator[AsyncSession]:
        yield db

    app.dependency_overrides[get_db_session] = override_db
    token = create_access_token(intra_id=user.intra_id, user_id=str(user.id))
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        cookies={"access_token": token},
        headers={"Authorization": f"Bearer {token}"},
    )


# ==============================================================================
# PROFILE TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_get_own_profile(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, _, _ = sample_users
    app = create_app()

    async with make_client(app, db, u1) as client:
        response = await client.get("/profile/me")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(u1.id)
    assert data["login"] == u1.login
    assert data["is_self"] is True
    assert "stats" in data
    assert "friends_count" in data["stats"]
    assert "projects_count" in data["stats"]


@pytest.mark.asyncio
async def test_update_own_profile(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, _, _ = sample_users
    app = create_app()

    async with make_client(app, db, u1) as client:
        response = await client.patch(
            "/profile/me",
            json={
                "bio": "Updated bio describing exciting project",
                "campus": "1337 Benguerir",
                "fullname": "Student One Updated",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["bio"] == "Updated bio describing exciting project"
    assert data["fullname"] == "Student One Updated"


@pytest.mark.asyncio
async def test_view_other_student_profile(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, u2, _ = sample_users
    app = create_app()

    async with make_client(app, db, u1) as client:
        response = await client.get(f"/profile/{u2.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(u2.id)
    assert data["login"] == u2.login
    assert data["is_self"] is False
    assert data["is_friend"] is False


@pytest.mark.asyncio
async def test_search_campus_users(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, u2, _ = sample_users
    app = create_app()

    async with make_client(app, db, u1) as client:
        response = await client.get("/users")

    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 2
    logins = [u["login"] for u in users]
    assert u2.login in logins
    assert u1.login not in logins  # Excludes self from directory search


# ==============================================================================
# FRIENDS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_add_and_list_friends(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, u2, _ = sample_users
    app = create_app()

    # 1. Add u2 as friend
    async with make_client(app, db, u1) as client:
        add_res = await client.post(f"/friends/{u2.id}")
        assert add_res.status_code == 200
        assert add_res.json()["status"] == "ok"

        # 2. List friends
        list_res = await client.get("/friends")
        assert list_res.status_code == 200
        friends = list_res.json()
        assert len(friends) >= 1
        assert any(f["id"] == str(u2.id) for f in friends)

        # 3. Check status endpoint
        status_res = await client.get(f"/friends/{u2.id}/status")
        assert status_res.status_code == 200
        assert status_res.json()["is_friend"] is True

        # 4. View u2 profile and check is_friend is True
        prof_res = await client.get(f"/profile/{u2.id}")
        assert prof_res.status_code == 200
        assert prof_res.json()["is_friend"] is True


@pytest.mark.asyncio
async def test_cannot_add_self_as_friend(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, _, _ = sample_users
    app = create_app()

    async with make_client(app, db, u1) as client:
        response = await client.post(f"/friends/{u1.id}")

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_remove_friend(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, u2, _ = sample_users
    app = create_app()

    async with make_client(app, db, u1) as client:
        # Add friend
        await client.post(f"/friends/{u2.id}")

        # Remove friend
        del_res = await client.delete(f"/friends/{u2.id}")
        assert del_res.status_code == 200

        # Check status is now false
        status_res = await client.get(f"/friends/{u2.id}/status")
        assert status_res.json()["is_friend"] is False


# ==============================================================================
# CHAT SYSTEM TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_send_and_receive_direct_message(db: AsyncSession, sample_users: tuple[Users, Users, Users]) -> None:
    u1, u2, _ = sample_users
    app = create_app()

    async with make_client(app, db, u1) as client_1:
        # 1. Send direct message
        send_res = await client_1.post(
            "/api/v1/chat/messages",
            json={"receiver_id": str(u2.id), "content": "Hello fellow 42 coder!"},
        )
        assert send_res.status_code == 201
        msg_data = send_res.json()
        assert msg_data["content"] == "Hello fellow 42 coder!"
        assert msg_data["sender_id"] == str(u1.id)
        assert msg_data["receiver_id"] == str(u2.id)
        msg_id = msg_data["id"]

        # 2. History check
        hist_res = await client_1.get(f"/messages/{u1.id}/{u2.id}")
        assert hist_res.status_code == 200
        history = hist_res.json()
        assert len(history) == 1
        assert history[0]["content"] == "Hello fellow 42 coder!"

    # 3. Check receiver's conversations and history
    async with make_client(app, db, u2) as client_2:
        convs_res = await client_2.get("/api/v1/chat/conversations")
        assert convs_res.status_code == 200
        convs = convs_res.json()
        assert len(convs) == 1
        assert convs[0]["peer"]["id"] == str(u1.id)
        assert convs[0]["unread_count"] == 1

        # 4. Mark message as read
        read_res = await client_2.post(f"/api/v1/chat/read/{msg_id}")
        assert read_res.status_code == 200
        assert read_res.json()["status"] == "ok"

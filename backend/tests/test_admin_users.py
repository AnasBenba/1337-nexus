"""Admin user-management API, end to end (HTTP -> FastAPI -> real DB).

Only touches users this file creates (login prefix below), so it is safe on a dev DB.
"""

import os
import uuid

import httpx
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.db import get_db_session
from app.main import fastapi_app
from app.oauth.jwt import create_access_token
from app.oauth.user import Users
from app.user.friends.models import Friendship

PREFIX = f"tadmin_{uuid.uuid4().hex[:6]}_"
BASE_INTRA_ID = 770000 + os.getpid() % 1000 * 10


@pytest_asyncio.fixture
async def ctx():
    url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url, poolclass=NullPool)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def session_override():
        async with factory() as s:
            yield s

    fastapi_app.dependency_overrides[get_db_session] = session_override
    async with factory() as s:
        admin = Users(login=PREFIX + "admin", fullname="Ada Admin", role="admin", intra_id=BASE_INTRA_ID + 1)
        alice = Users(login=PREFIX + "alice", fullname="Alice", role="user", intra_id=BASE_INTRA_ID + 2, bio="hi")
        bob = Users(login=PREFIX + "bob", fullname="Bob", role="user", intra_id=BASE_INTRA_ID + 3)
        s.add_all([admin, alice, bob])
        await s.commit()
        s.add(Friendship(requester_id=alice.id, addressee_id=bob.id, status="accepted"))
        await s.commit()

    def client(user: Users) -> httpx.AsyncClient:
        assert user.intra_id is not None
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=fastapi_app),
            base_url="http://test/api/v1/admin",
            cookies={"access_token": create_access_token(user.intra_id)},
        )

    yield {"admin": admin, "alice": alice, "bob": bob, "client": client, "factory": factory}

    fastapi_app.dependency_overrides.pop(get_db_session, None)
    async with engine.begin() as conn:
        await conn.execute(delete(Users).where(Users.login.like(f"{PREFIX}%")))
    await engine.dispose()


async def test_regular_user_gets_403(ctx) -> None:
    async with ctx["client"](ctx["alice"]) as c:
        assert (await c.get("/users")).status_code == 403
        assert (await c.delete(f"/users/{ctx['bob'].id}")).status_code == 403


async def test_list_search_filter_paginate(ctx) -> None:
    async with ctx["client"](ctx["admin"]) as c:
        page = (await c.get("/users", params={"q": PREFIX})).json()
        assert page["total"] == 3
        only_admins = (await c.get("/users", params={"q": PREFIX, "role": "admin"})).json()
        assert [u["login"] for u in only_admins["items"]] == [PREFIX + "admin"]
        first = (await c.get("/users", params={"q": PREFIX, "page_size": 2, "page": 2})).json()
        assert len(first["items"]) == 1 and first["total"] == 3
        assert (await c.get("/users", params={"role": "moderator"})).status_code == 422


async def test_view_and_edit_user(ctx) -> None:
    alice = ctx["alice"]
    async with ctx["client"](ctx["admin"]) as c:
        assert (await c.get(f"/users/{alice.id}")).json()["bio"] == "hi"
        r = await c.patch(f"/users/{alice.id}", json={"fullname": " Alice A. ", "bio": ""})
        assert r.status_code == 200
        assert r.json()["fullname"] == "Alice A." and r.json()["bio"] is None
        assert (await c.patch(f"/users/{alice.id}", json={"login": "hacked"})).status_code == 422
        assert (await c.patch(f"/users/{alice.id}", json={"fullname": ""})).status_code == 422
        assert (await c.get("/users/999999999")).status_code == 404


async def test_change_role_but_not_your_own(ctx) -> None:
    alice, admin = ctx["alice"], ctx["admin"]
    async with ctx["client"](admin) as c:
        assert (await c.patch(f"/users/{alice.id}", json={"role": "admin"})).json()["role"] == "admin"
        r = await c.patch(f"/users/{admin.id}", json={"role": "user"})
        assert r.status_code == 400
    # Alice is admin now: the change takes effect on her very next request.
    async with ctx["client"](alice) as c:
        assert (await c.get("/users")).status_code == 200


async def test_remove_avatar(ctx) -> None:
    bob = ctx["bob"]
    async with ctx["factory"]() as s:
        (await s.get(Users, bob.id)).avatar_url = "/media/avatars/does-not-exist.webp"
        await s.commit()
    async with ctx["client"](ctx["admin"]) as c:
        r = await c.delete(f"/users/{bob.id}/avatar")
    assert r.status_code == 200 and r.json()["avatar_url"] is None


async def test_delete_user_cascades_but_not_yourself(ctx) -> None:
    alice, bob, admin = ctx["alice"], ctx["bob"], ctx["admin"]
    async with ctx["client"](admin) as c:
        assert (await c.delete(f"/users/{admin.id}")).status_code == 400
        assert (await c.delete(f"/users/{bob.id}")).status_code == 204
        assert (await c.get(f"/users/{bob.id}")).status_code == 404
    async with ctx["factory"]() as s:
        rows = await s.execute(select(Friendship).where(Friendship.requester_id == alice.id))
        assert rows.first() is None  # friendship deleted with bob

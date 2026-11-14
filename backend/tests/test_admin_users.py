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
        users = {
            "boss": Users(login=PREFIX + "boss", fullname="Sam Super", role="superadmin"),
            "admin": Users(login=PREFIX + "admin", fullname="Ada Admin", role="admin"),
            "admin2": Users(login=PREFIX + "admin2", fullname="Abe Admin", role="admin"),
            "alice": Users(login=PREFIX + "alice", fullname="Alice", role="user", bio="hi"),
            "bob": Users(login=PREFIX + "bob", fullname="Bob", role="user"),
        }
        s.add_all(users.values())
        await s.commit()
        s.add(Friendship(requester_id=users["alice"].id, addressee_id=users["bob"].id, status="accepted"))
        await s.commit()

    def client(user: Users) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=fastapi_app),
            base_url="http://test/api/v1/admin",
            cookies={"access_token": create_access_token(user.id)},
        )

    yield {**users, "client": client, "factory": factory}

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
        assert (await c.get("/users", params={"q": PREFIX})).json()["total"] == 5
        admins = (await c.get("/users", params={"q": PREFIX, "role": "admin"})).json()
        assert sorted(u["login"] for u in admins["items"]) == [PREFIX + "admin", PREFIX + "admin2"]
        last = (await c.get("/users", params={"q": PREFIX, "page_size": 2, "page": 3})).json()
        assert len(last["items"]) == 1 and last["total"] == 5
        assert (await c.get("/users", params={"role": "moderator"})).status_code == 422


async def test_admin_edits_a_user(ctx) -> None:
    alice = ctx["alice"]
    async with ctx["client"](ctx["admin"]) as c:
        assert (await c.get(f"/users/{alice.id}")).json()["bio"] == "hi"
        r = await c.patch(f"/users/{alice.id}", json={"fullname": " Alice A. ", "bio": ""})
        assert r.status_code == 200
        assert r.json()["fullname"] == "Alice A." and r.json()["bio"] is None
        assert (await c.patch(f"/users/{alice.id}", json={"login": "hacked"})).status_code == 422
        assert (await c.patch(f"/users/{alice.id}", json={"fullname": ""})).status_code == 422
        assert (await c.get(f"/users/{uuid.uuid4()}")).status_code == 404


async def test_only_superadmin_changes_roles(ctx) -> None:
    alice, admin2 = ctx["alice"], ctx["admin2"]
    async with ctx["client"](ctx["admin"]) as c:
        r = await c.patch(f"/users/{alice.id}", json={"role": "admin"})
        assert r.status_code == 403 and "superadmin" in r.json()["detail"]
    async with ctx["client"](ctx["boss"]) as c:
        assert (await c.patch(f"/users/{alice.id}", json={"role": "admin"})).json()["role"] == "admin"
        assert (await c.patch(f"/users/{admin2.id}", json={"role": "user"})).json()["role"] == "user"
        # The superadmin role can't be handed out through the API, even by the superadmin.
        assert (await c.patch(f"/users/{alice.id}", json={"role": "superadmin"})).status_code == 422
    async with ctx["client"](alice) as c:  # takes effect on her very next request
        assert (await c.get("/users")).status_code == 200


async def test_admins_cannot_manage_admins_or_the_superadmin(ctx) -> None:
    admin2, boss = ctx["admin2"], ctx["boss"]
    async with ctx["client"](ctx["admin"]) as c:
        for target in (admin2, boss):
            assert (await c.patch(f"/users/{target.id}", json={"fullname": "x"})).status_code == 403
            assert (await c.delete(f"/users/{target.id}/avatar")).status_code == 403
            assert (await c.delete(f"/users/{target.id}")).status_code == 403
        own = await c.patch(f"/users/{ctx['admin'].id}", json={"fullname": "x"})
        assert own.status_code == 403  # not even yourself, here


async def test_superadmin_manages_admins_but_is_itself_protected(ctx) -> None:
    boss, admin2 = ctx["boss"], ctx["admin2"]
    async with ctx["client"](boss) as c:
        assert (await c.patch(f"/users/{admin2.id}", json={"fullname": "Abe B."})).status_code == 200
        assert (await c.delete(f"/users/{admin2.id}")).status_code == 204
        r = await c.patch(f"/users/{boss.id}", json={"role": "user"})
        assert r.status_code == 403  # can't demote or delete itself: always one superadmin
        assert (await c.delete(f"/users/{boss.id}")).status_code == 403


async def test_remove_avatar(ctx) -> None:
    bob = ctx["bob"]
    async with ctx["factory"]() as s:
        (await s.get(Users, bob.id)).avatar_url = "/media/avatars/does-not-exist.webp"
        await s.commit()
    async with ctx["client"](ctx["admin"]) as c:
        r = await c.delete(f"/users/{bob.id}/avatar")
    assert r.status_code == 200 and r.json()["avatar_url"] is None


async def test_delete_user_cascades(ctx) -> None:
    alice, bob = ctx["alice"], ctx["bob"]
    async with ctx["client"](ctx["admin"]) as c:
        assert (await c.delete(f"/users/{bob.id}")).status_code == 204
        assert (await c.get(f"/users/{bob.id}")).status_code == 404
    async with ctx["factory"]() as s:
        rows = await s.execute(select(Friendship).where(Friendship.requester_id == alice.id))
        assert rows.first() is None  # friendship deleted with bob

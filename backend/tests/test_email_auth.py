"""Email/password sign-up and login, end to end (HTTP -> FastAPI -> real DB).

Only touches accounts this file creates (login/email prefix below), so it is safe on a dev DB.
"""

import os
import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core import db
from app.core.db import get_db_session
from app.main import fastapi_app
from app.oauth import manager
from app.oauth.user import Users

TAG = uuid.uuid4().hex[:6]
PREFIX = f"tmail{TAG}"
DOMAIN = f"{TAG}.example.com"
PASSWORD = "correct horse battery"


def _signup(n: str, **overrides: str) -> dict[str, str]:
    body = {"email": f"{n}@{DOMAIN}", "login": f"{PREFIX}{n}", "fullname": f"User {n}", "password": PASSWORD}
    return {**body, **overrides}


@pytest_asyncio.fixture
async def ctx(monkeypatch: pytest.MonkeyPatch):
    url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url, poolclass=NullPool)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def session_override():
        async with factory() as s:
            yield s

    fastapi_app.dependency_overrides[get_db_session] = session_override
    monkeypatch.setattr(db, "SessionLocal", factory)  # for manager.manage_user
    monkeypatch.setattr(db, "migration_engine", engine)

    def client() -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.ASGITransport(app=fastapi_app), base_url="http://test/api/v1")

    yield {"client": client, "factory": factory}

    fastapi_app.dependency_overrides.pop(get_db_session, None)
    async with engine.begin() as conn:
        await conn.execute(
            delete(Users).where(or_(Users.login.like(f"{PREFIX}%"), Users.email.like(f"%@{DOMAIN}")))
        )
    await engine.dispose()


async def _stored(ctx, login: str) -> Users:
    async with ctx["factory"]() as s:
        return await s.scalar(select(Users).where(Users.login == login))


async def test_signup_creates_user_and_logs_in(ctx) -> None:
    async with ctx["client"]() as c:
        r = await c.post("/auth/signup", json=_signup("a", email=f"A@{DOMAIN.upper()}"))
        assert r.status_code == 201
        body = r.json()
        assert uuid.UUID(body["id"]).version == 4
        assert body["role"] == "user" and "password" not in str(body) and "profile:edit_own" in body["permissions"]
        assert {"access_token", "refresh_token"} <= set(r.cookies)
        assert (await c.get("/users/me")).json()["login"] == f"{PREFIX}a"  # cookie works
    user = await _stored(ctx, f"{PREFIX}a")
    assert user.email == f"a@{DOMAIN}"  # lowercased


async def test_profile_update_keeps_uuid_identity(ctx) -> None:
    async with ctx["client"]() as c:
        await c.post("/auth/signup", json=_signup("profile"))
        before = (await c.get("/users/me")).json()
        updated = await c.put("/users/me", json={"fullname": " Updated Name ", "bio": " hello "})
        assert updated.status_code == 200
        body = updated.json()
        assert body["id"] == before["id"]
        uuid.UUID(body["id"])
        assert body["fullname"] == "Updated Name" and body["bio"] == "hello"


async def test_logout_revokes_session(ctx) -> None:
    async with ctx["client"]() as c:
        await c.post("/auth/signup", json=_signup("logout"))
        assert (await c.get("/users/me")).status_code == 200
        assert (await c.post("/auth/logout")).status_code == 204
        assert (await c.get("/users/me")).status_code == 401
        assert (await c.get("/auth/session")).json() == {"signed_in": False}


async def test_passwords_are_salted_hashes(ctx) -> None:
    async with ctx["client"]() as c:
        await c.post("/auth/signup", json=_signup("h1"))
        await c.post("/auth/signup", json=_signup("h2"))  # same password
    h1, h2 = (await _stored(ctx, f"{PREFIX}h1")).password_hash, (await _stored(ctx, f"{PREFIX}h2")).password_hash
    assert h1 and h1.startswith("$argon2id$") and PASSWORD not in h1
    assert h1 != h2  # different random salt per user


async def test_duplicates_are_rejected(ctx) -> None:
    async with ctx["client"]() as c:
        assert (await c.post("/auth/signup", json=_signup("d"))).status_code == 201
        same_email = await c.post("/auth/signup", json=_signup("x", email=f"D@{DOMAIN}"))
        same_login = await c.post("/auth/signup", json=_signup("y", login=f"{PREFIX}D"))
    assert same_email.status_code == 409 and "email" in same_email.json()["detail"]
    assert same_login.status_code == 409 and "username" in same_login.json()["detail"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "not-an-email"},
        {"password": "short"},
        {"password": " " * 10},
        {"password": "x" * 129},
        {"login": "me"},  # reserved (would clash with /users/me)
        {"login": "ab"},
        {"login": "has space"},
        {"fullname": "   "},
        {"role": "admin"},  # sign-up can never choose a role
    ],
)
async def test_invalid_signup_is_rejected(ctx, overrides: dict[str, str]) -> None:
    async with ctx["client"]() as c:
        r = await c.post("/auth/signup", json=_signup("v", **overrides))
    assert r.status_code == 422


async def test_login(ctx) -> None:
    async with ctx["client"]() as c:
        await c.post("/auth/signup", json=_signup("l"))
    async with ctx["client"]() as c:  # fresh client: no cookies
        ok = await c.post("/auth/login", json={"email": f"L@{DOMAIN}", "password": PASSWORD})
        assert ok.status_code == 200 and {"access_token", "refresh_token"} <= set(ok.cookies)
        wrong = await c.post("/auth/login", json={"email": f"l@{DOMAIN}", "password": "wrong password"})
        unknown = await c.post("/auth/login", json={"email": f"nobody@{DOMAIN}", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()  # doesn't reveal whether the email exists


async def test_42_only_account_cannot_password_login(ctx) -> None:
    async with ctx["factory"]() as s:
        s.add(Users(login=f"{PREFIX}intra", fullname="I", role="user", intra_id=660001, email=f"intra@{DOMAIN}"))
        await s.commit()
    async with ctx["client"]() as c:
        r = await c.post("/auth/login", json={"email": f"intra@{DOMAIN}", "password": PASSWORD})
    assert r.status_code == 401


async def test_42_login_never_hijacks_an_email_account_with_the_same_username(ctx) -> None:
    async with ctx["client"]() as c:
        squatter = (await c.post("/auth/signup", json=_signup("sq"))).json()
    real = await manager.manage_user(
        {"id": 660002, "login": f"{PREFIX}sq", "displayname": "Real 42 user", "email": f"real@{DOMAIN}"}
    )
    assert real.id != squatter["id"]
    assert real.login == f"{PREFIX}sq-42" and real.intra_id == 660002
    again = await manager.manage_user({"id": 660002, "login": f"{PREFIX}sq", "displayname": "x"})
    assert again.id == real.id  # matched by 42 id next time


async def test_session_check_never_401s_and_renews_from_refresh_cookie(ctx) -> None:
    async with ctx["client"]() as c:
        r = await c.get("/auth/session")
        assert r.status_code == 200 and r.json() == {"signed_in": False}  # logged out: still 200

        await c.post("/auth/signup", json=_signup("s"))
        assert (await c.get("/auth/session")).json() == {"signed_in": True}

        # Access token gone (e.g. expired), refresh cookie still there: renewed silently.
        c.cookies.delete("access_token")
        r = await c.get("/auth/session")
        assert r.json() == {"signed_in": True} and "access_token" in r.cookies

        c.cookies.clear()
        c.cookies.set("access_token", "garbage")
        assert (await c.get("/auth/session")).json() == {"signed_in": False}

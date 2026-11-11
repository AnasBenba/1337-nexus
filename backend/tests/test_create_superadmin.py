"""create_superadmin seed script against the real DB (only touches accounts it creates)."""

import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.cli.create_superadmin import SuperadminSetupError, config_from_env, ensure_superadmin
from app.oauth.passwords import verify_password
from app.oauth.user import Users

TAG = uuid.uuid4().hex[:6]
EMAIL = f"root@{TAG}.example.com"
LOGIN = f"tseed{TAG}"


@pytest_asyncio.fixture
async def factory():
    url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url, poolclass=NullPool)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(delete(Users).where(or_(Users.login.like(f"tseed{TAG}%"), Users.email.like(f"%@{TAG}.example.com"))))
    await engine.dispose()


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch):
    def set_env(**values: str) -> None:
        for key in ("SUPERADMIN_EMAIL", "SUPERADMIN_PASSWORD", "SUPERADMIN_LOGIN", "SUPERADMIN_NAME"):
            monkeypatch.delenv(key, raising=False)
        for key, value in values.items():
            monkeypatch.setenv(key, value)

    return set_env


async def _get(factory) -> Users:
    async with factory() as s:
        return await s.scalar(select(Users).where(Users.email == EMAIL))


def test_skips_when_not_configured(env) -> None:
    env()
    assert config_from_env() is None


@pytest.mark.parametrize(
    "values",
    [
        {"SUPERADMIN_EMAIL": EMAIL},  # password missing
        {"SUPERADMIN_EMAIL": "not-an-email", "SUPERADMIN_PASSWORD": "long enough pw"},
        {"SUPERADMIN_EMAIL": EMAIL, "SUPERADMIN_PASSWORD": "short"},
    ],
)
def test_bad_config_fails_loudly(env, values: dict[str, str]) -> None:
    env(**values)
    with pytest.raises(SuperadminSetupError):
        config_from_env()


async def test_creates_superadmin_then_is_idempotent(factory, env) -> None:
    env(SUPERADMIN_EMAIL=EMAIL.upper(), SUPERADMIN_PASSWORD="first password", SUPERADMIN_LOGIN=LOGIN)
    async with factory() as s:
        assert await ensure_superadmin(s, config_from_env()) == "created"
    admin = await _get(factory)
    assert admin.role == "superadmin" and admin.login == LOGIN
    assert admin.password_hash.startswith("$argon2id$")
    assert verify_password("first password", admin.password_hash)[0]

    # Next container start with a *different* password in .env: password is not overwritten.
    env(SUPERADMIN_EMAIL=EMAIL, SUPERADMIN_PASSWORD="changed in env", SUPERADMIN_LOGIN=LOGIN)
    async with factory() as s:
        assert await ensure_superadmin(s, config_from_env()) == "unchanged"
    assert verify_password("first password", (await _get(factory)).password_hash)[0]


async def test_promotes_existing_account_with_that_email(factory, env) -> None:
    async with factory() as s:
        s.add(Users(login=LOGIN + "u", fullname="U", role="user", email=EMAIL))
        await s.commit()
    env(SUPERADMIN_EMAIL=EMAIL, SUPERADMIN_PASSWORD="whatever pw", SUPERADMIN_LOGIN=LOGIN)
    async with factory() as s:
        assert await ensure_superadmin(s, config_from_env()) == "promoted"
    assert (await _get(factory)).role == "superadmin"


async def test_username_taken_by_someone_else_is_an_error(factory, env) -> None:
    async with factory() as s:
        s.add(Users(login=LOGIN, fullname="Other", role="user", email=f"other@{TAG}.example.com"))
        await s.commit()
    env(SUPERADMIN_EMAIL=EMAIL, SUPERADMIN_PASSWORD="long enough pw", SUPERADMIN_LOGIN=LOGIN)
    async with factory() as s:
        with pytest.raises(SuperadminSetupError, match="already used"):
            await ensure_superadmin(s, config_from_env())

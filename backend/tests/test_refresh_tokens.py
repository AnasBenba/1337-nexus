"""Refresh-token rotation against the real database (only touches users it creates)."""

import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.oauth import refresh_tokens as rt
from app.oauth.user import Users

PREFIX = f"trefresh_{uuid.uuid4().hex[:6]}_"


@pytest_asyncio.fixture
async def factory():
    url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url, poolclass=NullPool)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:  # tokens go too (ON DELETE CASCADE)
        await conn.execute(delete(Users).where(Users.login.like(f"{PREFIX}%")))
    await engine.dispose()


@pytest_asyncio.fixture
async def token(factory) -> str:
    async with factory() as s:
        user = Users(login=PREFIX + "u", fullname="U", role="user", intra_id=880000 + os.getpid() % 1000)
        s.add(user)
        await s.commit()
        raw = await rt.issue(s, user.id)
        await s.commit()
        return raw


async def _set(factory, raw: str, **values) -> None:
    async with factory() as s:
        await s.execute(update(rt.RefreshToken).where(rt.RefreshToken.token_hash == rt._hash(raw)).values(**values))
        await s.commit()


async def test_rotation_issues_a_new_token(factory, token) -> None:
    async with factory() as s:
        user, new = await rt.rotate(s, token)
    assert new is not None and new != token
    async with factory() as s:
        user2, newer = await rt.rotate(s, new)  # the new one works too
    assert user2.id == user.id and newer is not None


async def test_raw_token_is_never_stored(factory, token) -> None:
    async with factory() as s:
        stored = (await s.execute(select(rt.RefreshToken.token_hash))).scalars().all()
    assert token not in stored


async def test_old_token_within_grace_gives_access_only(factory, token) -> None:
    async with factory() as s:
        await rt.rotate(s, token)
    async with factory() as s:
        _, new = await rt.rotate(s, token)  # second tab, a moment later
    assert new is None


async def test_reuse_after_grace_revokes_every_session(factory, token) -> None:
    async with factory() as s:
        _, new = await rt.rotate(s, token)
    await _set(factory, token, rotated_at=datetime.now(UTC) - timedelta(minutes=5))
    async with factory() as s:
        with pytest.raises(rt.RefreshError, match="reuse"):
            await rt.rotate(s, token)  # attacker replays the old token
    async with factory() as s:
        with pytest.raises(rt.RefreshError):
            await rt.rotate(s, new)  # ...so the legit newer token is dead too


async def test_revoked_and_expired_tokens_fail(factory, token) -> None:
    async with factory() as s:
        await rt.revoke(s, token)  # logout
        with pytest.raises(rt.RefreshError):
            await rt.rotate(s, token)
        with pytest.raises(rt.RefreshError):
            await rt.rotate(s, "not-a-real-token")


async def test_expired_token_fails(factory, token) -> None:
    await _set(factory, token, expires_at=datetime.now(UTC) - timedelta(seconds=1))
    async with factory() as s:
        with pytest.raises(rt.RefreshError):
            await rt.rotate(s, token)


async def test_two_tabs_refreshing_at_once_both_succeed(factory, token) -> None:
    async def refresh() -> str | None:
        async with factory() as s:
            return (await rt.rotate(s, token))[1]

    results = await asyncio.gather(refresh(), refresh())
    assert sum(r is not None for r in results) == 1  # exactly one new refresh token

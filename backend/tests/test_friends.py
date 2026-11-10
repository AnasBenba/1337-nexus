"""Friendship rules against the real database.

Only touches users this file creates (login prefix below), so it is safe to run on a dev DB.
"""

import asyncio
import os
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.oauth.user import Users
from app.user.friends import service
from app.user.friends.models import Friendship

PREFIX = f"tfriend_{uuid.uuid4().hex[:6]}_"


@pytest_asyncio.fixture
async def factory():
    url = os.environ["DATABASE_URL"].replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url, poolclass=NullPool)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:  # friendships go too (ON DELETE CASCADE)
        await conn.execute(delete(Users).where(Users.login.like(f"{PREFIX}%")))
    await engine.dispose()


@pytest_asyncio.fixture
async def users(factory) -> tuple[Users, Users]:
    async with factory() as s:
        a = Users(login=PREFIX + "a", fullname="A", role="user")
        b = Users(login=PREFIX + "b", fullname="B", role="user")
        s.add_all([a, b])
        await s.commit()
        return a, b


async def test_request_then_accept(factory, users) -> None:
    a, b = users
    async with factory() as s:
        assert await service.add_friend(s, a, b) == "outgoing"
        assert await service.get_status(s, b, a) == "incoming"
        # b clicking "Add friend" back accepts the request
        assert await service.add_friend(s, b, a) == "friends"
        assert await service.get_status(s, a, b) == "friends"

        overview = await service.overview(s, a)
        assert [u.login for u in overview.friends] == [b.login]
        assert overview.incoming == overview.outgoing == []


async def test_add_twice_is_idempotent(factory, users) -> None:
    a, b = users
    async with factory() as s:
        await service.add_friend(s, a, b)
        assert await service.add_friend(s, a, b) == "outgoing"
        rows = await s.execute(select(Friendship).where(Friendship.requester_id == a.id))
        assert len(rows.all()) == 1


async def test_remove_cancels_declines_and_unfriends(factory, users) -> None:
    a, b = users
    async with factory() as s:
        await service.add_friend(s, a, b)
        assert await service.remove_friend(s, b, a) == "none"  # b declines
        await service.add_friend(s, a, b)
        await service.add_friend(s, b, a)
        assert await service.remove_friend(s, a, b) == "none"  # a unfriends
        assert await service.get_status(s, b, a) == "none"


async def test_cannot_add_yourself(factory, users) -> None:
    a, _ = users
    async with factory() as s:
        with pytest.raises(ValueError):
            await service.add_friend(s, a, a)


async def test_simultaneous_requests_end_up_as_one_friendship(factory, users) -> None:
    a, b = users

    async def add(me: Users, other: Users) -> str:
        async with factory() as s:
            return await service.add_friend(s, me, other)

    results = await asyncio.gather(add(a, b), add(b, a))
    async with factory() as s:
        rows = (await s.execute(select(Friendship).where(service._between(a.id, b.id)))).scalars().all()
    assert len(rows) == 1  # unique pair index: never two rows
    assert "outgoing" in results or "friends" in results

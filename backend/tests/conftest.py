import pytest

from app.core.db import engine


@pytest.fixture(autouse=True)
async def cleanup_db_engine():
    yield
    await engine.dispose()

from __future__ import annotations

import os
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

import app.collaboration.board.models  # noqa: F401
import app.collaboration.chat.models  # noqa: F401
import app.models.canvas  # noqa: F401
import app.models.copilot  # noqa: F401
import app.models.curriculum  # noqa: F401
import app.models.job  # noqa: F401
import app.models.suggestion  # noqa: F401
import app.oauth.user  # noqa: F401
import app.teams.models  # noqa: F401
import app.user.opportunities.apply.models  # noqa: F401
import app.user.opportunities.browse_opportunities.models  # noqa: F401
import app.user.pitches.models  # noqa: F401

# Import all application models to guarantee full registration in Base.metadata
from app.shared.models import Base

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://nexus:CHANGE_ME@localhost:5433/nexus",
)


@pytest.mark.asyncio
async def test_all_orm_models_exist_in_postgresql_database() -> None:
    """Strict contract test: verifies every SQLAlchemy model table and column

    physically exists in the PostgreSQL database. Catches missing Alembic migrations!
    """
    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            def inspect_db(sync_conn):
                inspector = inspect(sync_conn)
                tables = set(inspector.get_table_names())
                columns = {
                    t: {c["name"] for c in inspector.get_columns(t)}
                    for t in tables
                }
                return tables, columns

            db_tables, db_columns = await conn.run_sync(inspect_db)

        # 1. Check table existence
        for table_name, table in Base.metadata.tables.items():
            assert table_name in db_tables, (
                f"DATABASE SCHEMA FAULT: Model table '{table_name}' is declared in the "
                f"codebase, but DOES NOT EXIST in the PostgreSQL database! "
                f"Did you forget to write or run an Alembic migration?"
            )

            # 2. Check column existence
            actual_cols = db_columns[table_name]
            for col in table.columns:
                assert col.name in actual_cols, (
                    f"DATABASE SCHEMA FAULT: Table '{table_name}' is missing column '{col.name}' "
                    f"in the PostgreSQL database! Model defines it, but database lacks it."
                )
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_alembic_migrations_are_fully_up_to_date() -> None:
    """Strict migration test: verifies PostgreSQL is migrated to the exact latest Alembic head."""
    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            def inspect_alembic(sync_conn):
                inspector = inspect(sync_conn)
                if not inspector.has_table("alembic_version"):
                    return None
                result = sync_conn.execute(sa_text("SELECT version_num FROM alembic_version"))
                return result.scalar()

            from sqlalchemy import text as sa_text
            current_db_version = await conn.run_sync(inspect_alembic)

        alembic_ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
        alembic_cfg = Config(str(alembic_ini_path))
        script = ScriptDirectory.from_config(alembic_cfg)
        expected_heads = script.get_heads()

        assert current_db_version is not None, "alembic_version table does not exist in PostgreSQL!"
        assert current_db_version in expected_heads, (
            f"Alembic database version '{current_db_version}' is not at the latest head {expected_heads}!"
        )
    finally:
        await engine.dispose()

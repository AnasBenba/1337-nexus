from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.models.canvas  # noqa: F401
import app.models.copilot  # noqa: F401
import app.models.curriculum  # noqa: F401
import app.models.job  # noqa: F401
import app.teams.models  # noqa: F401
from alembic import context
from app.collaboration.board import models as board_models  # noqa: F401
from app.collaboration.chat import models as chat_models  # noqa: F401
from app.core.config import get_settings
from app.oauth import user  # noqa: F401
from app.shared.models import Base
from app.user.opportunities.apply.models import Application  # noqa: F401
from app.user.opportunities.browse_opportunities.models import Opportunity  # noqa: F401
from app.user.pitches.models import Pitch  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()

config.set_main_option(
    "sqlalchemy.url",
    settings.async_migration_database_url,
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.async_migration_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    import asyncio

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Integer, String, select
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from ..core import base


class Users(base.Base):  # type: ignore[misc]
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
    )
    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    login: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    fullname: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        default="user",
        nullable=False,
    )  # 'user' | 'admin' | 'moderator'
    intra_id: Mapped[int | None] = mapped_column(
        Integer,
        unique=True,
        index=True,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> Users | None:
    statement = select(Users).where(Users.id == user_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_user_by_intra_id(session: AsyncSession, intra_id: int) -> Users | None:
    statement = select(Users).where(Users.intra_id == intra_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_user_by_email_or_login(session: AsyncSession, identifier: str) -> Users | None:
    statement = select(Users).where((Users.email == identifier) | (Users.login == identifier))
    result = await session.execute(statement)
    return result.scalar_one_or_none()

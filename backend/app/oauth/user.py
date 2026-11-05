from sqlalchemy.orm import Mapped, mapped_column
from ..core import base
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class Users(base.Base):  # type: ignore[misc]
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column()
    fullname: Mapped[str] = mapped_column()
    role: Mapped[str] = mapped_column()  # either user || admin
    intra_id: Mapped[int | None] = mapped_column(nullable=True)



async def get_user_by_intra_id(session: AsyncSession, intra_id: int) -> Users | None:
    statement = select(Users).where(Users.intra_id == intra_id)

    result = await session.execute(statement)

    return result.scalar_one_or_none()
from sqlalchemy.orm import Mapped, mapped_column

from ..core import base


class Users(base.Base):  # type: ignore[misc]
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column()
    fullname: Mapped[str] = mapped_column()
    role: Mapped[str] = mapped_column()  # either user || admin
    intra_id: Mapped[int | None] = mapped_column(nullable=True)

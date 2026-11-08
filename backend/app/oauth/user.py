from sqlalchemy.orm import Mapped, mapped_column

from ..core import base
import uuid
from sqlalchemy import Uuid


class Users(base.Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4
    )
    login: Mapped[str] = mapped_column()
    fullname: Mapped[str] = mapped_column()
    role: Mapped[str] = mapped_column()  # either user || admin
    intra_id: Mapped[int | None] = mapped_column(nullable=True)

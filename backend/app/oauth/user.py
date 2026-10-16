from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from ..core import base

class Users(base.Base):
    __tablename__ = "users"
    id : Mapped[int] = mapped_column(primary_key = True)
    login : Mapped[str] = mapped_column()
    fullname : Mapped[str] = mapped_column()
    
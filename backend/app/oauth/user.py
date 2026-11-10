from sqlalchemy import CheckConstraint, ColumnElement, String, or_
from sqlalchemy.orm import Mapped, mapped_column

from ..core import base


class Users(base.Base):
    __tablename__ = "users"
    # Same values as app.oauth.permissions.Role; the DB rejects anything else.
    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column()
    fullname: Mapped[str] = mapped_column()
    role: Mapped[str] = mapped_column(default="user")  # see app.oauth.permissions.Role
    intra_id: Mapped[int | None] = mapped_column(nullable=True)
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)


def login_or_name_contains(q: str) -> ColumnElement[bool]:
    """Case-insensitive "login or fullname contains q" filter, used by user search."""
    # Escape LIKE wildcards so "%" or "_" in the query are matched literally.
    pattern = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    return or_(Users.login.ilike(pattern, escape="\\"), Users.fullname.ilike(pattern, escape="\\"))

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base


class Friendship(Base):
    """One row per pair of users.

    pending:  requester asked addressee, waiting for an answer.
    accepted: they are friends (direction no longer matters).

    The migration also adds a unique index on (LEAST(a, b), GREATEST(a, b)) so a pair
    can only ever have one row, even if both users click "Add friend" at the same time.
    """

    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint("requester_id <> addressee_id", name="ck_friendships_not_self"),
        CheckConstraint("status IN ('pending', 'accepted')", name="ck_friendships_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    addressee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

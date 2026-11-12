"""create notifications

Revision ID: 981b5d2e4771
Revises: f9c4a2d7e6b1
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "981b5d2e4771"
down_revision: str | Sequence[str] | None = "f9c4a2d7e6b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


notification_type = postgresql.ENUM(
    "USER_MESSAGE",
    "FRIEND_REQUEST",
    name="notificationtype",
)


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "notification_request_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("type", notification_type, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_notifications_recipient_read",
        "notifications",
        ["recipient_id", "is_read"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_read", table_name="notifications")
    op.drop_table("notifications")
    notification_type.drop(op.get_bind(), checkfirst=True)

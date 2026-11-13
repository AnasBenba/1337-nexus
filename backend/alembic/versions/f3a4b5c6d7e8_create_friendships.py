"""create friendships

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: str | None = "e2f3a4b5c6d7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "friendships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "requester_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "addressee_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("requester_id <> addressee_id", name="ck_friendships_not_self"),
        sa.CheckConstraint("status IN ('pending', 'accepted')", name="ck_friendships_status"),
    )
    op.create_index("ix_friendships_addressee_id", "friendships", ["addressee_id"])
    # One row per unordered pair: (1,2) and (2,1) collide.
    op.create_index(
        "uq_friendships_pair",
        "friendships",
        [sa.text("LEAST(requester_id, addressee_id)"), sa.text("GREATEST(requester_id, addressee_id)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("friendships")

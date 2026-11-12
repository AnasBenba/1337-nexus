"""add pitch votes

Revision ID: c2a8f4e91d63
Revises: 981b5d2e4771
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "c2a8f4e91d63"
down_revision: str | Sequence[str] | None = "981b5d2e4771"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pitch_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pitch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_upvote", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["pitch_id"], ["pitches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "pitch_id",
            "user_id",
            name="uq_pitch_votes_pitch_user",
        ),
    )
    op.create_index("ix_pitch_votes_pitch_id", "pitch_votes", ["pitch_id"])
    op.create_index("ix_pitch_votes_user_id", "pitch_votes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_pitch_votes_user_id", table_name="pitch_votes")
    op.drop_index("ix_pitch_votes_pitch_id", table_name="pitch_votes")
    op.drop_table("pitch_votes")

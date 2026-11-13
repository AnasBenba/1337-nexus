"""create workspace team members

Revision ID: c8f6d2e0b315
Revises: b7e5c1d9a204
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8f6d2e0b315"
down_revision: str | Sequence[str] | None = "b7e5c1d9a204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workspace_team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspace_teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), server_default="invited", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "user_id", name="uq_workspace_team_member"),
    )
    op.create_index("ix_workspace_team_members_team_id", "workspace_team_members", ["team_id"])
    op.create_index("ix_workspace_team_members_user_id", "workspace_team_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_workspace_team_members_user_id", table_name="workspace_team_members")
    op.drop_index("ix_workspace_team_members_team_id", table_name="workspace_team_members")
    op.drop_table("workspace_team_members")

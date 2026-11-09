"""create workspace entities

Revision ID: f2a6b8c4d901
Revises: 4fadc9b3fb19
Create Date: 2026-10-26 06:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "f2a6b8c4d901"
down_revision: str | Sequence[str] | None = "4fadc9b3fb19"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workspace_teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("opportunity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "founder_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "opportunity_id",
            name="uq_workspace_team_opportunity",
        ),
    )
    op.create_index(
        "ix_workspace_teams_opportunity_id",
        "workspace_teams",
        ["opportunity_id"],
    )
    op.create_index(
        "ix_workspace_teams_founder_id",
        "workspace_teams",
        ["founder_id"],
    )

    for table_name, label in (
        ("workspace_boards", "Main Board"),
        ("workspace_canvas_documents", "Main Canvas"),
        ("workspace_channels", "general"),
    ):
        op.create_table(
            table_name,
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column(
                "name",
                sa.String(length=100),
                server_default=sa.text(f"'{label}'"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("team_id"),
        )
        op.create_index(
            f"ix_{table_name}_team_id",
            table_name,
            ["team_id"],
        )


def downgrade() -> None:
    for table_name in (
        "workspace_channels",
        "workspace_canvas_documents",
        "workspace_boards",
    ):
        op.drop_index(f"ix_{table_name}_team_id", table_name=table_name)
        op.drop_table(table_name)

    op.drop_index("ix_workspace_teams_founder_id", table_name="workspace_teams")
    op.drop_index("ix_workspace_teams_opportunity_id", table_name="workspace_teams")
    op.drop_table("workspace_teams")

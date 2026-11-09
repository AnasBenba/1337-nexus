"""allow workspace teams to belong to a pitch

Revision ID: 6a2b9c4d1e8f
Revises: 5e6f7a8b9c0d
Create Date: 2026-11-08 22:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "6a2b9c4d1e8f"
down_revision: str | Sequence[str] | None = "5e6f7a8b9c0d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "workspace_teams",
        "opportunity_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.add_column(
        "workspace_teams",
        sa.Column("pitch_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_workspace_teams_pitch_id_pitches",
        "workspace_teams",
        "pitches",
        ["pitch_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_workspace_team_pitch",
        "workspace_teams",
        ["pitch_id"],
    )
    op.create_check_constraint(
        "ck_workspace_teams_exactly_one_owner",
        "workspace_teams",
        "(opportunity_id IS NOT NULL AND pitch_id IS NULL) OR "
        "(opportunity_id IS NULL AND pitch_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_workspace_teams_exactly_one_owner",
        "workspace_teams",
        type_="check",
    )
    op.drop_constraint(
        "uq_workspace_team_pitch",
        "workspace_teams",
        type_="unique",
    )
    op.drop_constraint(
        "fk_workspace_teams_pitch_id_pitches",
        "workspace_teams",
        type_="foreignkey",
    )
    op.drop_column("workspace_teams", "pitch_id")
    op.alter_column(
        "workspace_teams",
        "opportunity_id",
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False,
    )

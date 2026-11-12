"""create workspace team members

Revision ID: c8f6d2e0b315
Revises: b7e5c1d9a204
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c8f6d2e0b315"
down_revision: str | Sequence[str] | None = "b7e5c1d9a204"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("workspace_team_members"):
        raise RuntimeError(
            "Expected workspace_team_members from migration 5e6f7a8b9c0d"
        )

    columns = {
        column["name"]
        for column in inspector.get_columns("workspace_team_members")
    }
    if "status" not in columns:
        op.add_column(
            "workspace_team_members",
            sa.Column(
                "status",
                sa.String(length=20),
                server_default="active",
                nullable=False,
            ),
        )
    inspector = sa.inspect(bind)
    check_constraints = {
        constraint["name"]
        for constraint in inspector.get_check_constraints("workspace_team_members")
    }
    if "ck_workspace_team_members_status" not in check_constraints:
        op.create_check_constraint(
            "ck_workspace_team_members_status",
            "workspace_team_members",
            "status IN ('invited', 'active')",
        )

    indexes = {
        index["name"] for index in inspector.get_indexes("workspace_team_members")
    }
    if "ix_workspace_team_members_team_id" not in indexes:
        op.create_index(
            "ix_workspace_team_members_team_id",
            "workspace_team_members",
            ["team_id"],
        )
    if "ix_workspace_team_members_user_id" not in indexes:
        op.create_index(
            "ix_workspace_team_members_user_id",
            "workspace_team_members",
            ["user_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("workspace_team_members"):
        return
    indexes = {
        index["name"] for index in inspector.get_indexes("workspace_team_members")
    }
    for index_name in (
        "ix_workspace_team_members_user_id",
        "ix_workspace_team_members_team_id",
    ):
        if index_name in indexes:
            op.drop_index(index_name, table_name="workspace_team_members")
    columns = {
        column["name"]
        for column in inspector.get_columns("workspace_team_members")
    }
    if "status" in columns:
        op.drop_constraint(
            "ck_workspace_team_members_status",
            "workspace_team_members",
            type_="check",
        )
        op.drop_column("workspace_team_members", "status")

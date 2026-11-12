"""make message team references use workspace UUIDs

Revision ID: 9f6c2a8d1b40
Revises: 8e4c2a6f1b9d
Create Date: 2026-11-09 17:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "9f6c2a8d1b40"
down_revision: str | Sequence[str] | None = "8e4c2a6f1b9d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("messages"):
        return

    columns = {column["name"]: column for column in inspector.get_columns("messages")}
    team_id = columns.get("team_id")
    if team_id is None or isinstance(team_id["type"], postgresql.UUID):
        return
    if not isinstance(team_id["type"], sa.Integer):
        raise RuntimeError(f"Unsupported messages.team_id type: {team_id['type']}")

    existing_values = bind.execute(
        sa.text("SELECT count(*) FROM messages WHERE team_id IS NOT NULL")
    ).scalar_one()
    if existing_values:
        raise RuntimeError(
            "Cannot convert messages.team_id to UUID: existing non-null team IDs "
            "need an explicit mapping to workspace_teams.id"
        )

    for foreign_key in inspector.get_foreign_keys("messages"):
        if "team_id" in (foreign_key.get("constrained_columns") or []):
            if foreign_key.get("name") is None:
                raise RuntimeError("Cannot safely migrate an unnamed messages.team_id foreign key")
            op.drop_constraint(
                foreign_key["name"],
                "messages",
                type_="foreignkey",
            )

    for index in inspector.get_indexes("messages"):
        if "team_id" in (index.get("column_names") or []):
            op.drop_index(index["name"], table_name="messages")

    op.alter_column(
        "messages",
        "team_id",
        existing_type=sa.Integer(),
        type_=postgresql.UUID(as_uuid=True),
        existing_nullable=True,
        postgresql_using="NULL::uuid",
    )
    op.create_foreign_key(
        "fk_messages_team_id_workspace_teams",
        "messages",
        "workspace_teams",
        ["team_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_messages_team_id", "messages", ["team_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("messages"):
        return

    columns = {column["name"]: column for column in inspector.get_columns("messages")}
    team_id = columns.get("team_id")
    if team_id is None or isinstance(team_id["type"], sa.Integer):
        return

    existing_values = bind.execute(
        sa.text("SELECT count(*) FROM messages WHERE team_id IS NOT NULL")
    ).scalar_one()
    if existing_values:
        raise RuntimeError(
            "Cannot downgrade messages.team_id to integer while team messages exist"
        )

    op.drop_constraint(
        "fk_messages_team_id_workspace_teams",
        "messages",
        type_="foreignkey",
    )
    op.drop_index("ix_messages_team_id", table_name="messages")
    op.alter_column(
        "messages",
        "team_id",
        existing_type=postgresql.UUID(as_uuid=True),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="NULL::integer",
    )
    op.create_index("ix_messages_team_id", "messages", ["team_id"])

"""normalize workspace user identity columns

Revision ID: e1a2b3c4d567
Revises: d9f7e3a1c426
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1a2b3c4d567"
down_revision: str | Sequence[str] | None = "d9f7e3a1c426"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _column_type(table_name: str, column_name: str) -> str:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            """
            SELECT data_type
            FROM information_schema.columns
            WHERE table_name = :table_name AND column_name = :column_name
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).scalar_one()
    return str(result)


def _assert_empty(table_name: str, column_name: str) -> None:
    bind = op.get_bind()
    count = bind.execute(
        sa.text(f"SELECT count(*) FROM {table_name}")
    ).scalar_one()
    if count:
        raise RuntimeError(
            f"Cannot convert {table_name}.{column_name} without a data migration; "
            f"{table_name} contains {count} row(s)."
        )


def upgrade() -> None:
    if _column_type("workspace_teams", "founder_id") == "uuid":
        _assert_empty("workspace_teams", "founder_id")
        op.alter_column(
            "workspace_teams",
            "founder_id",
            type_=sa.Integer(),
            postgresql_using="NULL::integer",
        )
        op.create_foreign_key(
            "workspace_teams_founder_id_fkey",
            "workspace_teams",
            "users",
            ["founder_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    if _column_type("workspace_teams", "founder_id") == "integer":
        _assert_empty("workspace_teams", "founder_id")
        op.drop_constraint(
            "workspace_teams_founder_id_fkey",
            "workspace_teams",
            type_="foreignkey",
        )
        op.alter_column(
            "workspace_teams",
            "founder_id",
            type_=sa.dialects.postgresql.UUID(as_uuid=True),
            postgresql_using="NULL::uuid",
        )

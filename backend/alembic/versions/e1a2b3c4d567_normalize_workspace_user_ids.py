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


def upgrade() -> None:
    for table_name, column_name in (
        ("users", "id"),
        ("workspace_teams", "founder_id"),
        ("workspace_team_members", "user_id"),
        ("projects", "owner_id"),
        ("applications", "user_id"),
    ):
        if _column_type(table_name, column_name) != "uuid":
            raise RuntimeError(
                f"Expected {table_name}.{column_name} to use UUID identities"
            )


def downgrade() -> None:
    pass

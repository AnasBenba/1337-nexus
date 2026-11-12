"""ensure workspace teams reference their founders

Revision ID: f9c4a2d7e6b1
Revises: f8b2c6d9a403
"""

from collections.abc import Sequence
import warnings

import sqlalchemy as sa
from alembic import op


revision: str = "f9c4a2d7e6b1"
down_revision: str | Sequence[str] | None = "f8b2c6d9a403"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    founder_foreign_key_exists = any(
        foreign_key.get("referred_table") == "users"
        and foreign_key.get("constrained_columns") == ["founder_id"]
        and foreign_key.get("referred_columns") == ["id"]
        for foreign_key in inspector.get_foreign_keys("workspace_teams")
    )
    if founder_foreign_key_exists:
        return

    orphaned_founders = bind.execute(
        sa.text(
            """
            SELECT count(*)
            FROM workspace_teams AS teams
            LEFT JOIN users ON users.id = teams.founder_id
            WHERE users.id IS NULL
            """
        )
    ).scalar_one()
    if orphaned_founders:
        warnings.warn(
            "Adding the workspace founder foreign key as NOT VALID because "
            f"{orphaned_founders} existing team founder(s) do not exist; "
            "new and updated rows will still be checked.",
            RuntimeWarning,
            stacklevel=2,
        )

    op.create_foreign_key(
        "workspace_teams_founder_id_fkey",
        "workspace_teams",
        "users",
        ["founder_id"],
        ["id"],
        ondelete="CASCADE",
        postgresql_not_valid=bool(orphaned_founders),
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if any(
        foreign_key.get("name") == "workspace_teams_founder_id_fkey"
        for foreign_key in inspector.get_foreign_keys("workspace_teams")
    ):
        op.drop_constraint(
            "workspace_teams_founder_id_fkey",
            "workspace_teams",
            type_="foreignkey",
        )

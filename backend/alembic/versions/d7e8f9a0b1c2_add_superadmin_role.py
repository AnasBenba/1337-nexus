"""allow the superadmin role

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
"""

from typing import Sequence

from alembic import op

revision: str = "d7e8f9a0b1c2"
down_revision: str | None = "c6d7e8f9a0b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint("ck_users_role", "users", "role IN ('user', 'admin', 'superadmin')")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'superadmin'")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint("ck_users_role", "users", "role IN ('user', 'admin')")

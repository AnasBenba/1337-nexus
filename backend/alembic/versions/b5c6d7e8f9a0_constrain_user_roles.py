"""constrain users.role to known roles

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
"""

from typing import Sequence

from alembic import op

revision: str = "b5c6d7e8f9a0"
down_revision: str | None = "a4b5c6d7e8f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLES = "('user', 'admin')"


def upgrade() -> None:
    # Older rows/tests used other values (e.g. 'student'); treat them as normal users.
    op.execute(f"UPDATE users SET role = 'user' WHERE role NOT IN {ROLES}")
    op.alter_column("users", "role", server_default="user")
    op.create_check_constraint("ck_users_role", "users", f"role IN {ROLES}")


def downgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.alter_column("users", "role", server_default=None)

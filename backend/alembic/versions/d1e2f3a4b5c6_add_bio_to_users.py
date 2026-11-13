"""add bio to users

Revision ID: d1e2f3a4b5c6
Revises: c60826774a67
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: str | None = "c60826774a67"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "bio")

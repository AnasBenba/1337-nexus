"""add avatar_url to users

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
"""

from typing import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e2f3a4b5c6d7"
down_revision: str | None = "d1e2f3a4b5c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")

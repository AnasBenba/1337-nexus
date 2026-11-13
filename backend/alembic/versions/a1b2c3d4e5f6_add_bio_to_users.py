"""add bio column to users

Revision ID: a1b2c3d4e5f6
Revises: 9f1a2b3c4d5e
Create Date: 2026-11-13 02:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "9f1a2b3c4d5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if inspector.has_table("users"):
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        if "bio" not in user_cols:
            op.add_column("users", sa.Column("bio", sa.String(length=500), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if inspector.has_table("users"):
        user_cols = {c["name"] for c in inspector.get_columns("users")}
        if "bio" in user_cols:
            op.drop_column("users", "bio")


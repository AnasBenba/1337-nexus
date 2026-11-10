"""add message delivery status

Revision ID: 7d2e4f6a8b1c
Revises: 6b8e2d4a1f09
Create Date: 2026-11-10 18:55:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d2e4f6a8b1c"
down_revision: Union[str, Sequence[str], None] = "6b8e2d4a1f09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("messages")]
    if "is_delivered" not in columns:
        op.add_column(
            "messages",
            sa.Column(
                "is_delivered",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            ),
        )


def downgrade() -> None:
    op.drop_column("messages", "is_delivered")


"""add message delivery status

Revision ID: 3c9e7a1b5d2f
Revises: a7d8e9f0b1c2
Create Date: 2026-11-06 17:20:00.000000
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "3c9e7a1b5d2f"
down_revision: str | None = "a7d8e9f0b1c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column(
            "is_delivered",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.execute(
        sa.text(
            "UPDATE messages "
            "SET is_delivered = is_read "
            "WHERE receiver_id IS NOT NULL AND team_id IS NULL"
        )
    )
    op.alter_column("messages", "is_delivered", server_default=None)


def downgrade() -> None:
    op.drop_column("messages", "is_delivered")

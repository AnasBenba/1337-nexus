"""add created_at to pitches

Revision ID: 8f2a1c6d4e90
Revises: c4d9e1f8a230
Create Date: 2026-10-22 00:24:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8f2a1c6d4e90"
down_revision: Union[str, Sequence[str], None] = "c4d9e1f8a230"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pitches",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("pitches", "created_at")

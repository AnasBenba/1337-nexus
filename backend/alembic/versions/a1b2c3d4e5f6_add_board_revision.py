"""add board revision tracking

Revision ID: a1b2c3d4e5f6
Revises: 9f6c2a8d1b40
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "9f6c2a8d1b40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "workspace_boards",
        sa.Column(
            "board_revision",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("workspace_boards", "board_revision")

"""merge canvas, workspace, and chat migration heads

Revision ID: d3e5f7a9b1c2
Revises: 8b2c9d0e1f3a, 9c4e7a1b2d3f, 2b7c8d9e0f1a
Create Date: 2026-11-05 17:00:00.000000
"""

from typing import Sequence, Union

revision: str = "d3e5f7a9b1c2"
down_revision: Union[str, Sequence[str], None] = (
    "8b2c9d0e1f3a",
    "9c4e7a1b2d3f",
    "2b7c8d9e0f1a",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

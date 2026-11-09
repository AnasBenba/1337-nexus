"""merge user_db migration heads

Revision ID: 1c2d3e4f5a6b
Revises: f4a6b8c0d2e1, 7a1f8c3e4b2d
Create Date: 2026-10-27 20:50:00.000000
"""

from typing import Sequence, Union


revision: str = "1c2d3e4f5a6b"
down_revision: Union[str, Sequence[str], None] = (
    "f4a6b8c0d2e1",
    "7a1f8c3e4b2d",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

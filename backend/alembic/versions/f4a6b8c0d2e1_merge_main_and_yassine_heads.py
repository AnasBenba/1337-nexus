"""merge main and Yassine migration heads

Revision ID: f4a6b8c0d2e1
Revises: e7f1a8b9c2d3, 9b3e7c1d2a40
Create Date: 2026-10-23 23:45:00.000000
"""

from typing import Sequence, Union


revision: str = "f4a6b8c0d2e1"
down_revision: Union[str, Sequence[str], None] = (
    "e7f1a8b9c2d3",
    "9b3e7c1d2a40",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

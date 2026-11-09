"""merge chat and workspace migration heads

Revision ID: a7d8e9f0b1c2
Revises: 2b7c8d9e0f1a, 8b2c9d0e1f3a, 9c4e7a1b2d3f
Create Date: 2026-11-05 15:32:00.000000
"""

from collections.abc import Sequence


revision: str = "a7d8e9f0b1c2"
down_revision: tuple[str, str, str] = (
    "2b7c8d9e0f1a",
    "8b2c9d0e1f3a",
    "9c4e7a1b2d3f",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

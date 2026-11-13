"""merge canvas and workspace heads

Revision ID: c60826774a67
Revises: 8b2c9d0e1f3a, 9c4e7a1b2d3f
"""

from typing import Sequence

revision: str = "c60826774a67"

down_revision: tuple[str, str] = (
    "8b2c9d0e1f3a",
    "9c4e7a1b2d3f",
)

branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

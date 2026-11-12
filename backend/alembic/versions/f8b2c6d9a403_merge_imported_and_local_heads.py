"""merge imported project and local chat migration heads

Revision ID: f8b2c6d9a403
Revises: e1a2b3c4d567, a1b2c3d4e5f6
"""

from collections.abc import Sequence


revision: str = "f8b2c6d9a403"
down_revision: tuple[str, str] = ("e1a2b3c4d567", "a1b2c3d4e5f6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

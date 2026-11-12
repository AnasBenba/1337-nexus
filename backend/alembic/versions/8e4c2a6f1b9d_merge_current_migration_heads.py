"""merge the workspace/chat and UUID user migration heads

Revision ID: 8e4c2a6f1b9d
Revises: d3e5f7a9b1c2, 7d3e9a1c5f20
Create Date: 2026-11-09 16:55:00.000000
"""

from collections.abc import Sequence


revision: str = "8e4c2a6f1b9d"
down_revision: tuple[str, str] = ("d3e5f7a9b1c2", "7d3e9a1c5f20")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

"""merge workspace and pitch migration heads

Revision ID: 9c4e7a1b2d3f
Revises: 7a1f8c3e4b2d, f2a6b8c4d901
Create Date: 2026-10-26 11:45:00.000000
"""

revision: str = "9c4e7a1b2d3f"
down_revision: tuple[str, str] = ("7a1f8c3e4b2d", "f2a6b8c4d901")
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

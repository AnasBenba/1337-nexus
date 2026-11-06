"""grant application permissions on pitches

Revision ID: 7c1c9f5e2a14
Revises: 5a8f9adede76
Create Date: 2026-10-21 00:49:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = "7c1c9f5e2a14"
down_revision: Union[str, Sequence[str], None] = "5a8f9adede76"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pitches TO nexus_app"
    )


def downgrade() -> None:
    op.execute(
        "REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE pitches FROM nexus_app"
    )

"""initial migration

Revision ID: b7a721fc05b8
Revises: 
Create Date: 2026-09-26 18:35:09.306423
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = 'b7a721fc05b8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply this migration."""
    pass


def downgrade() -> None:
    """Reverse this migration."""
    pass
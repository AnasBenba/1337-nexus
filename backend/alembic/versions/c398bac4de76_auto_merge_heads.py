"""auto_merge_heads

Revision ID: c398bac4de76
Revises: d7e8f9a0b1c2, e1a2b3c4d567
Create Date: 2026-11-13 21:52:44.738621
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = 'c398bac4de76'
down_revision: Union[str, Sequence[str], None] = ('d7e8f9a0b1c2', 'e1a2b3c4d567')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply this migration."""
    pass


def downgrade() -> None:
    """Reverse this migration."""
    pass
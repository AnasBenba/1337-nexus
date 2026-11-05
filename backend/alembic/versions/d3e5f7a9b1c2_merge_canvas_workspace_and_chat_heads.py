"""merge canvas, workspace, and chat migration heads

Revision ID: d3e5f7a9b1c2
Revises: 8b2c9d0e1f3a, 9c4e7a1b2d3f, 2b7c8d9e0f1a
Create Date: 2026-11-05 17:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d3e5f7a9b1c2"
down_revision: Union[str, Sequence[str], None] = (
    "8b2c9d0e1f3a",
    "9c4e7a1b2d3f",
    "2b7c8d9e0f1a",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "pitches" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("pitches")]
        if "author_id" not in columns:
            op.add_column(
                "pitches",
                sa.Column(
                    "author_id",
                    sa.Integer(),
                    sa.ForeignKey("users.id", ondelete="SET NULL"),
                    nullable=True,
                ),
            )
            op.create_index("ix_pitches_author_id", "pitches", ["author_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "pitches" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("pitches")]
        if "author_id" in columns:
            op.drop_index("ix_pitches_author_id", table_name="pitches")
            op.drop_column("pitches", "author_id")

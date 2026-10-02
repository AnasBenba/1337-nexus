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
    pitch_category = sa.Enum(
        "TECH",
        "HEALTH",
        "BUSINESS",
        "EDUCATION",
        "ENVIRONMENT",
        "ENTERTAINMENT",
        "SOCIAL_IMPACT",
        "FINANCE",
        "FOOD_BEVERAGE",
        "FASHION_DESIGN",
        name="pitchcategory",
    )
    pitch_status = sa.Enum(
        "DRAFT",
        "PUBLISHED",
        "ARCHIVED",
        name="pitchstatus",
    )

    op.create_table(
        "pitches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", pitch_category, nullable=False),
        sa.Column("status", pitch_status, nullable=False),
        sa.Column("author_id", sa.String(), nullable=False),
    )
    op.create_index("ix_pitches_title", "pitches", ["title"])
    op.create_index("ix_pitches_author_id", "pitches", ["author_id"])
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pitches TO nexus_app"
    )
    op.execute(
        "GRANT USAGE, SELECT, UPDATE ON SEQUENCE pitches_id_seq TO nexus_app"
    )
    op.execute("GRANT USAGE ON TYPE pitchcategory, pitchstatus TO nexus_app")


def downgrade() -> None:
    """Reverse this migration."""
    op.execute("DROP TABLE IF EXISTS pitches CASCADE")
    op.execute("DROP TYPE IF EXISTS pitchcategory")
    op.execute("DROP TYPE IF EXISTS pitchstatus")
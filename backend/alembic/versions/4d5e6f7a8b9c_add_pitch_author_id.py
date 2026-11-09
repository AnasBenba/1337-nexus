"""add pitch author id when missing

Revision ID: 4d5e6f7a8b9c
Revises: 3c9e7a1b5d2f
Create Date: 2026-11-07 18:40:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "4d5e6f7a8b9c"
down_revision: str | None = "3c9e7a1b5d2f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = {column["name"] for column in inspector.get_columns("pitches")}

    if "author_id" not in columns:
        op.add_column(
            "pitches",
            sa.Column("author_id", sa.Integer(), nullable=True),
        )

    foreign_keys = inspector.get_foreign_keys("pitches")
    has_author_foreign_key = any(
        foreign_key.get("referred_table") == "users"
        and foreign_key.get("constrained_columns") == ["author_id"]
        for foreign_key in foreign_keys
    )
    if not has_author_foreign_key:
        op.create_foreign_key(
            "fk_pitches_author_id_users",
            "pitches",
            "users",
            ["author_id"],
            ["id"],
            ondelete="SET NULL",
        )

    indexes = {index["name"] for index in inspector.get_indexes("pitches")}
    if "ix_pitches_author_id" not in indexes:
        op.create_index("ix_pitches_author_id", "pitches", ["author_id"])


def downgrade() -> None:
    # author_id may have been created by an earlier migration; preserve it on downgrade.
    pass

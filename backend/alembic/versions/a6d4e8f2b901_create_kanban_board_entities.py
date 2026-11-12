"""create kanban board entities

Revision ID: a6d4e8f2b901
Revises: 8b2c9d0e1f3a, 9c4e7a1b2d3f
Create Date: 2026-11-04 23:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a6d4e8f2b901"
down_revision: tuple[str, str] = ("8b2c9d0e1f3a", "9c4e7a1b2d3f")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "board_revision" not in {
        column["name"] for column in inspector.get_columns("workspace_boards")
    }:
        op.add_column(
            "workspace_boards",
            sa.Column(
                "board_revision",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
        )

    op.create_table(
        "board_columns",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "board_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspace_boards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("board_id", "name", name="uq_board_columns_board_name"),
    )
    op.create_index("ix_board_columns_board_id", "board_columns", ["board_id"])

    op.create_table(
        "board_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "column_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("board_columns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rank", sa.String(length=20, collation="C"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("column_id", "rank", name="uq_board_cards_column_rank"),
    )
    op.create_index("ix_board_cards_column_id", "board_cards", ["column_id"])


def downgrade() -> None:
    op.drop_index("ix_board_cards_column_id", table_name="board_cards")
    op.drop_table("board_cards")
    op.drop_index("ix_board_columns_board_id", table_name="board_columns")
    op.drop_table("board_columns")
    inspector = sa.inspect(op.get_bind())
    if "board_revision" in {
        column["name"] for column in inspector.get_columns("workspace_boards")
    }:
        op.drop_column("workspace_boards", "board_revision")

"""create kanban board tables and board revision

Revision ID: 8e3a5f7c9d0b
Revises: 7d2e4f6a8b1c
Create Date: 2026-11-10 19:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "8e3a5f7c9d0b"
down_revision: Union[str, Sequence[str], None] = "7d2e4f6a8b1c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. Add board_revision to workspace_boards if not present
    wb_cols = [c["name"] for c in inspector.get_columns("workspace_boards")]
    if "board_revision" not in wb_cols:
        op.add_column(
            "workspace_boards",
            sa.Column(
                "board_revision",
                sa.Integer(),
                server_default="0",
                nullable=False,
            ),
        )

    # 2. Create board_columns table
    if not inspector.has_table("board_columns"):
        op.create_table(
            "board_columns",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["board_id"],
                ["workspace_boards.id"],
                name="fk_board_columns_board_id_workspace_boards",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("board_id", "name", name="uq_board_columns_board_name"),
        )
        op.create_index(
            op.f("ix_board_columns_board_id"),
            "board_columns",
            ["board_id"],
            unique=False,
        )

    # 3. Create board_cards table
    if not inspector.has_table("board_cards"):
        op.create_table(
            "board_cards",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("column_id", postgresql.UUID(as_uuid=True), nullable=False),
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
            sa.ForeignKeyConstraint(
                ["column_id"],
                ["board_columns.id"],
                name="fk_board_cards_column_id_board_columns",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("column_id", "rank", name="uq_board_cards_column_rank"),
        )
        op.create_index(
            op.f("ix_board_cards_column_id"),
            "board_cards",
            ["column_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_board_cards_column_id"), table_name="board_cards")
    op.drop_table("board_cards")

    op.drop_index(op.f("ix_board_columns_board_id"), table_name="board_columns")
    op.drop_table("board_columns")

    op.drop_column("workspace_boards", "board_revision")


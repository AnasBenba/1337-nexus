"""create chat messages table

Revision ID: 2b7c8d9e0f1a
Revises: 1c2d3e4f5a6b
Create Date: 2026-11-03 04:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2b7c8d9e0f1a"
down_revision: Union[str, Sequence[str], None] = "1c2d3e4f5a6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    messages_exists = inspector.has_table("messages")

    if not messages_exists:
        op.create_table(
            "messages",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("sender_id", sa.Integer(), nullable=False),
            sa.Column("team_id", sa.Integer(), nullable=True),
            sa.Column("receiver_id", sa.Integer(), nullable=True),
            sa.Column("is_read", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["receiver_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    elif "team_id" not in {column["name"] for column in inspector.get_columns("messages")}:
        op.add_column("messages", sa.Column("team_id", sa.Integer(), nullable=True))

    index_names = {index["name"] for index in inspector.get_indexes("messages")}
    if "ix_messages_id" not in index_names:
        op.create_index("ix_messages_id", "messages", ["id"], unique=False)
    if "ix_messages_team_id" not in index_names:
        op.create_index("ix_messages_team_id", "messages", ["team_id"], unique=False)
    if "ix_messages_direct_conversation" not in index_names:
        op.create_index(
            "ix_messages_direct_conversation",
            "messages",
            ["sender_id", "receiver_id", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("messages"):
        return

    index_names = {index["name"] for index in inspector.get_indexes("messages")}
    for index_name in (
        "ix_messages_direct_conversation",
        "ix_messages_team_id",
        "ix_messages_id",
    ):
        if index_name in index_names:
            op.drop_index(index_name, table_name="messages")

    columns = {column["name"] for column in inspector.get_columns("messages")}
    if "team_id" in columns:
        op.drop_column("messages", "team_id")

"""create copilot_threads and copilot_messages tables

Revision ID: e7f1a8b9c2d3
Revises: c4d9e1f8a230
Create Date: 2026-10-20 18:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e7f1a8b9c2d3"
down_revision: Union[str, Sequence[str], None] = "c4d9e1f8a230"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "copilot_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subject_slug", sa.String(length=100), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False, server_default="New Thread"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_copilot_threads_user_id"), "copilot_threads", ["user_id"], unique=False)
    op.create_index(op.f("ix_copilot_threads_project_id"), "copilot_threads", ["project_id"], unique=False)
    op.create_index(op.f("ix_copilot_threads_subject_slug"), "copilot_threads", ["subject_slug"], unique=False)

    op.create_table(
        "copilot_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="completed"),
        sa.Column("context_chunks", postgresql.JSONB(), nullable=True),
        sa.Column("tokens", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["thread_id"], ["copilot_threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_copilot_messages_thread_id"), "copilot_messages", ["thread_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_copilot_messages_thread_id"), table_name="copilot_messages")
    op.drop_table("copilot_messages")
    op.drop_index(op.f("ix_copilot_threads_subject_slug"), table_name="copilot_threads")
    op.drop_index(op.f("ix_copilot_threads_project_id"), table_name="copilot_threads")
    op.drop_index(op.f("ix_copilot_threads_user_id"), table_name="copilot_threads")
    op.drop_table("copilot_threads")

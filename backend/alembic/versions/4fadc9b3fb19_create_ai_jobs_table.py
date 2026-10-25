"""create ai_jobs table

Revision ID: 4fadc9b3fb19
Revises: e7f1a8b9c2d3
Create Date: 2026-10-24 16:55:27.815564
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "4fadc9b3fb19"
down_revision: Union[str, Sequence[str], None] = "e7f1a8b9c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("job_type", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default=sa.text("3")),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_by", sa.String(length=255), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_jobs_job_type"), "ai_jobs", ["job_type"], unique=False)
    op.create_index(op.f("ix_ai_jobs_lease_expires_at"), "ai_jobs", ["lease_expires_at"], unique=False)
    op.create_index(op.f("ix_ai_jobs_status"), "ai_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_jobs_status"), table_name="ai_jobs")
    op.drop_index(op.f("ix_ai_jobs_lease_expires_at"), table_name="ai_jobs")
    op.drop_index(op.f("ix_ai_jobs_job_type"), table_name="ai_jobs")
    op.drop_table("ai_jobs")

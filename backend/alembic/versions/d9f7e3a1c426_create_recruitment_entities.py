"""create recruitment entities

Revision ID: d9f7e3a1c426
Revises: c8f6d2e0b315
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d9f7e3a1c426"
down_revision: str | Sequence[str] | None = "c8f6d2e0b315"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "opportunities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("required_skills", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(length=50), server_default="draft", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_opportunities_id", "opportunities", ["id"])
    op.create_index("ix_opportunities_project_id", "opportunities", ["project_id"])
    op.create_index("ix_opportunities_status", "opportunities", ["status"])

    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "opportunity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("opportunities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("candidate_skills", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "opportunity_id", name="uq_application_user_opportunity"),
    )
    op.create_index("ix_applications_opportunity_id", "applications", ["opportunity_id"])
    op.create_index("ix_applications_user_id", "applications", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_applications_user_id", table_name="applications")
    op.drop_index("ix_applications_opportunity_id", table_name="applications")
    op.drop_table("applications")
    op.drop_index("ix_opportunities_status", table_name="opportunities")
    op.drop_index("ix_opportunities_project_id", table_name="opportunities")
    op.drop_index("ix_opportunities_id", table_name="opportunities")
    op.drop_table("opportunities")

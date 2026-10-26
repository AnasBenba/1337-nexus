"""create pitches, critiques, and suggestions

Revision ID: 7a1f8c3e4b2d
Revises: 4fadc9b3fb19
Create Date: 2026-10-25 18:35:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = "7a1f8c3e4b2d"
down_revision: Union[str, Sequence[str], None] = "4fadc9b3fb19"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table (if not exists)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("login", sa.String(100), nullable=False),
            sa.Column("fullname", sa.String(255), nullable=False),
            sa.Column("role", sa.String(50), nullable=False, default="user"),
            sa.Column("intra_id", sa.Integer(), nullable=True),
        )
        op.create_index("ix_users_login", "users", ["login"], unique=True)

    # 2. pitches table
    if "pitches" not in tables:
        pitchcategory = postgresql.ENUM(
            "TECH", "HEALTH", "BUSINESS", "EDUCATION", "ENVIRONMENT",
            "ENTERTAINMENT", "SOCIAL_IMPACT", "FINANCE", "FOOD_BEVERAGE", "FASHION_DESIGN",
            name="pitchcategory",
            create_type=False,
        )
        pitchcategory.create(conn, checkfirst=True)

        pitchstatus = postgresql.ENUM(
            "DRAFT", "PUBLISHED", "ARCHIVED", "PENDING",
            name="pitchstatus",
            create_type=False,
        )
        pitchstatus.create(conn, checkfirst=True)

        op.create_table(
            "pitches",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("rendered_content", sa.Text(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("category", pitchcategory, nullable=False),
            sa.Column("status", pitchstatus, nullable=False, server_default="DRAFT"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("embedding", Vector(1536), nullable=True),
            sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )
        op.create_index("ix_pitches_id", "pitches", ["id"])
        op.create_index("ix_pitches_title", "pitches", ["title"])
        op.create_index("ix_pitches_author_id", "pitches", ["author_id"])
        op.create_index("ix_pitches_status", "pitches", ["status"])

    # 3. pitch_critiques table
    if "pitch_critiques" not in tables:
        op.create_table(
            "pitch_critiques",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("pitch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pitches.id", ondelete="CASCADE"), nullable=False),
            sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_jobs.id", ondelete="SET NULL"), nullable=True),
            sa.Column("base_hash", sa.String(64), nullable=False),
            sa.Column("current_hash", sa.String(64), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("strengths", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_pitch_critiques_pitch_id", "pitch_critiques", ["pitch_id"])
        op.create_index("ix_pitch_critiques_job_id", "pitch_critiques", ["job_id"])
        op.create_index("ix_pitch_critiques_base_hash", "pitch_critiques", ["base_hash"])

    # 4. pitch_suggestions table
    if "pitch_suggestions" not in tables:
        op.create_table(
            "pitch_suggestions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("critique_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pitch_critiques.id", ondelete="CASCADE"), nullable=False),
            sa.Column("pitch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pitches.id", ondelete="CASCADE"), nullable=False),
            sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_jobs.id", ondelete="SET NULL"), nullable=True),
            sa.Column("base_hash", sa.String(64), nullable=False),
            sa.Column("field", sa.String(50), nullable=False),
            sa.Column("section_label", sa.String(100), nullable=False),
            sa.Column("severity", sa.String(20), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("original_excerpt", sa.Text(), nullable=False),
            sa.Column("suggested_text", sa.Text(), nullable=False),
            sa.Column("rationale", sa.Text(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_pitch_suggestions_critique_id", "pitch_suggestions", ["critique_id"])
        op.create_index("ix_pitch_suggestions_pitch_id", "pitch_suggestions", ["pitch_id"])
        op.create_index("ix_pitch_suggestions_status", "pitch_suggestions", ["status"])


def downgrade() -> None:
    op.drop_table("pitch_suggestions")
    op.drop_table("pitch_critiques")
    op.drop_table("pitches")
    op.drop_table("users")
    conn = op.get_bind()
    postgresql.ENUM(name="pitchstatus").drop(conn, checkfirst=True)
    postgresql.ENUM(name="pitchcategory").drop(conn, checkfirst=True)

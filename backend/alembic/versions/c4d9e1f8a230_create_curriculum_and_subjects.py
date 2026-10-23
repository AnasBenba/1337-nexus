"""create curriculum and subjects tables

Revision ID: c4d9e1f8a230
Revises: b7a721fc05b8
Create Date: 2026-10-13 04:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector
from app.shared.ai.config import EMBEDDING_DIMENSIONS

revision: str = "c4d9e1f8a230"
down_revision: Union[str, Sequence[str], None] = "b7a721fc05b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# def upgrade() -> None:
#     op.execute("CREATE EXTENSION IF NOT EXISTS vector")

#     # Existing table creation code follows...

def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Existing table creation code follows...
    op.create_table(
        "subjects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(op.f("ix_subjects_slug"), "subjects", ["slug"], unique=True)
    op.create_table(
        "subject_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("sha256_hash", sa.String(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sha256_hash"),
    )
    op.create_index(op.f("ix_subject_documents_subject_id"), "subject_documents", ["subject_id"], unique=False)
    op.create_index(op.f("ix_subject_documents_sha256_hash"), "subject_documents", ["sha256_hash"], unique=True)
    op.create_table(
        "curriculum_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunk_metadata", postgresql.JSONB(), nullable=True),
        sa.Column("embedding", Vector(EMBEDDING_DIMENSIONS), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["subject_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_curriculum_chunks_document_id"), "curriculum_chunks", ["document_id"], unique=False)
    op.create_table(
        "ingestion_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("chunks_generated", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["subject_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ingestion_runs_document_id"), "ingestion_runs", ["document_id"], unique=False)

def downgrade() -> None:
    op.drop_table("ingestion_runs")
    op.drop_table("curriculum_chunks")
    op.drop_table("subject_documents")
    op.drop_table("subjects")

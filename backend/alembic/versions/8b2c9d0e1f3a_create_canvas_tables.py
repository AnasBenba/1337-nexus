"""create canvas_documents and canvas_updates tables

Revision ID: 8b2c9d0e1f3a
Revises: 7a1f8c3e4b2d
Create Date: 2026-11-02 23:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "8b2c9d0e1f3a"
down_revision: Union[str, Sequence[str], None] = "7a1f8c3e4b2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. canvas_documents table
    if not inspector.has_table("canvas_documents"):
        op.create_table(
            "canvas_documents",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column("name", sa.String(length=255), nullable=False, server_default="Untitled Whiteboard"),
            sa.Column("snapshot", sa.LargeBinary(), nullable=False, server_default=sa.text("''::bytea")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )

    # 2. canvas_updates table
    if not inspector.has_table("canvas_updates"):
        op.create_table(
            "canvas_updates",
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
            sa.Column(
                "document_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("canvas_documents.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("sequence_number", sa.BigInteger(), nullable=False),
            sa.Column("data", sa.LargeBinary(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.UniqueConstraint("document_id", "sequence_number", name="uq_canvas_updates_doc_seq"),
        )
        op.create_index(
            "ix_canvas_updates_document_sequence",
            "canvas_updates",
            ["document_id", "sequence_number"],
        )


def downgrade() -> None:
    op.drop_table("canvas_updates")
    op.drop_table("canvas_documents")


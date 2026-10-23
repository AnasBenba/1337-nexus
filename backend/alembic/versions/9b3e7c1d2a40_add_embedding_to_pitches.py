"""add embeddings to pitches

Revision ID: 9b3e7c1d2a40
Revises: 8f2a1c6d4e90
Create Date: 2026-10-23 22:22:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

from app.shared.ai.config import EMBEDDING_DIMENSIONS


revision: str = "9b3e7c1d2a40"
down_revision: Union[str, Sequence[str], None] = "8f2a1c6d4e90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pitches",
        sa.Column("embedding", Vector(EMBEDDING_DIMENSIONS), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pitches", "embedding")

"""Convert pitch identifiers from integers to UUIDs.

Revision ID: 20261004_pitch_id_to_uuid
Revises: b7a721fc05b8
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20261004_pitch_id_to_uuid"
down_revision: str | None = "b7a721fc05b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE pitches ALTER COLUMN id DROP DEFAULT")
    op.alter_column(
        "pitches",
        "id",
        existing_type=postgresql.INTEGER(),
        type_=postgresql.UUID(as_uuid=True),
        postgresql_using="gen_random_uuid()",
    )


def downgrade() -> None:
    raise NotImplementedError("Pitch UUID to integer conversion is not supported")
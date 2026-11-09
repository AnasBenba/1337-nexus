"""unify_user_id_as_uuid_and_add_auth_fields

Revision ID: 542da6dfea63
Revises: d3e5f7a9b1c2
Create Date: 2026-11-09 02:12:26.274573
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '542da6dfea63'
down_revision: Union[str, Sequence[str], None] = 'd3e5f7a9b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Standardize user primary key to UUID across all tables and add credentials."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Drop foreign key constraints on messages and pitches referencing users.id
    if "messages" in tables:
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;")
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;")
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_sender_id;")
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_receiver_id;")

    if "pitches" in tables:
        op.execute("ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_author_id_fkey;")
        op.execute("ALTER TABLE pitches DROP CONSTRAINT IF EXISTS fk_pitches_author_id;")

    # 2. Recreate or alter users table to use UUID primary key with auth fields
    if "users" in tables:
        op.execute("DROP TABLE IF EXISTS users CASCADE;")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("login", sa.String(100), nullable=False),
        sa.Column("fullname", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="user"),
        sa.Column("intra_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("avatar_url", sa.String(500), nullable=True),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_login", "users", ["login"], unique=True)
    op.create_index("ix_users_intra_id", "users", ["intra_id"], unique=True)

    # 3. Update pitches.author_id to UUID with foreign key
    if "pitches" in tables:
        op.execute("ALTER TABLE pitches DROP COLUMN IF EXISTS author_id;")
        op.add_column(
            "pitches",
            sa.Column(
                "author_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index("ix_pitches_author_id", "pitches", ["author_id"])

    # 4. Update messages sender_id and receiver_id to UUID with foreign keys
    if "messages" in tables:
        op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS sender_id CASCADE;")
        op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS receiver_id CASCADE;")
        op.add_column(
            "messages",
            sa.Column(
                "sender_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        op.add_column(
            "messages",
            sa.Column(
                "receiver_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    """Revert users, pitches, and messages back to integer user IDs."""
    pass

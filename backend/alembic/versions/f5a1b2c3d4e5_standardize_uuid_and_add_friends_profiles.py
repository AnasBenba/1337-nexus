"""standardize_uuid_and_add_friends_profiles

Revision ID: f5a1b2c3d4e5
Revises: e1a2b3c4d567
Create Date: 2026-11-10 16:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f5a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e1a2b3c4d567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Drop existing FK constraints to users
    if "messages" in tables:
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey CASCADE;")
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey CASCADE;")
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_sender_id CASCADE;")
        op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_receiver_id CASCADE;")

    if "pitches" in tables:
        op.execute("ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_author_id_fkey CASCADE;")
        op.execute("ALTER TABLE pitches DROP CONSTRAINT IF EXISTS fk_pitches_author_id CASCADE;")

    if "projects" in tables:
        op.execute("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_owner_id_fkey CASCADE;")

    if "applications" in tables:
        op.execute("ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_user_id_fkey CASCADE;")

    if "workspace_teams" in tables:
        op.execute("ALTER TABLE workspace_teams DROP CONSTRAINT IF EXISTS workspace_teams_founder_id_fkey CASCADE;")

    if "workspace_team_members" in tables:
        op.execute("ALTER TABLE workspace_team_members DROP CONSTRAINT IF EXISTS workspace_team_members_user_id_fkey CASCADE;")

    # 2. Recreate or alter users table with UUID PK and profile fields
    op.execute("DROP TABLE IF EXISTS users CASCADE;")
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("login", sa.String(100), nullable=False),
        sa.Column("fullname", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="user"),
        sa.Column("intra_id", sa.Integer(), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("campus", sa.String(100), nullable=True, server_default="1337 Benguerir"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_login", "users", ["login"], unique=True)
    op.create_index("ix_users_intra_id", "users", ["intra_id"], unique=True)

    # 3. Update pitches.author_id to UUID
    if "pitches" in tables:
        op.execute("ALTER TABLE pitches DROP COLUMN IF EXISTS author_id CASCADE;")
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

    # 4. Update messages columns to UUID and add is_delivered
    if "messages" in tables:
        op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS sender_id CASCADE;")
        op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS receiver_id CASCADE;")
        op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS team_id CASCADE;")
        op.add_column(
            "messages",
            sa.Column(
                "sender_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
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
        op.add_column(
            "messages",
            sa.Column(
                "team_id",
                postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
        )
        # Check if is_delivered exists
        msg_columns = [c["name"] for c in inspector.get_columns("messages")]
        if "is_delivered" not in msg_columns:
            op.add_column(
                "messages",
                sa.Column("is_delivered", sa.Boolean(), nullable=False, server_default=sa.false()),
            )

    # 5. Update projects.owner_id to UUID
    if "projects" in tables:
        op.execute("ALTER TABLE projects DROP COLUMN IF EXISTS owner_id CASCADE;")
        op.add_column(
            "projects",
            sa.Column(
                "owner_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
        )
        op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    # 6. Update applications.user_id to UUID
    if "applications" in tables:
        op.execute("ALTER TABLE applications DROP COLUMN IF EXISTS user_id CASCADE;")
        op.add_column(
            "applications",
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
        )
        op.create_index("ix_applications_user_id", "applications", ["user_id"])
        op.create_unique_constraint(
            "uq_application_user_opportunity",
            "applications",
            ["user_id", "opportunity_id"],
        )

    # 7. Update workspace_teams.founder_id to UUID
    if "workspace_teams" in tables:
        op.execute("ALTER TABLE workspace_teams DROP COLUMN IF EXISTS founder_id CASCADE;")
        op.add_column(
            "workspace_teams",
            sa.Column(
                "founder_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
        )
        op.create_index("ix_workspace_teams_founder_id", "workspace_teams", ["founder_id"])

    # 8. Update workspace_team_members.user_id to UUID
    if "workspace_team_members" in tables:
        op.execute("ALTER TABLE workspace_team_members DROP COLUMN IF EXISTS user_id CASCADE;")
        op.add_column(
            "workspace_team_members",
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
        )
        op.create_index("ix_workspace_team_members_user_id", "workspace_team_members", ["user_id"])

    # 9. Create friendships table
    op.execute("DROP TABLE IF EXISTS friendships CASCADE;")
    op.create_table(
        "friendships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("friend_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="accepted"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "friend_id", name="uq_friendships_user_friend"),
        sa.CheckConstraint("user_id != friend_id", name="ck_friendships_no_self"),
    )
    op.create_index("ix_friendships_id", "friendships", ["id"])
    op.create_index("ix_friendships_user_id", "friendships", ["user_id"])
    op.create_index("ix_friendships_friend_id", "friendships", ["friend_id"])


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS friendships CASCADE;")

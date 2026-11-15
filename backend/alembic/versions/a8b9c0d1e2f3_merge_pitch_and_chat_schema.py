"""merge pitch and chat schema from yassine branch

Revision ID: a8b9c0d1e2f3
Revises: f7a2c9d4e681
Create Date: 2026-11-15 15:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a8b9c0d1e2f3"
down_revision: str | Sequence[str] | None = "f7a2c9d4e681"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

notification_type = postgresql.ENUM(
    "USER_MESSAGE",
    "FRIEND_REQUEST",
    name="notificationtype",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # 1. Create pitch_votes table
    if "pitch_votes" not in tables:
        op.create_table(
            "pitch_votes",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("pitch_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("is_upvote", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["pitch_id"], ["pitches.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "pitch_id",
                "user_id",
                name="uq_pitch_votes_pitch_user",
            ),
        )
        op.create_index("ix_pitch_votes_pitch_id", "pitch_votes", ["pitch_id"])
        op.create_index("ix_pitch_votes_user_id", "pitch_votes", ["user_id"])

    # 2. Create notifications table
    if "notifications" not in tables:
        postgresql.ENUM(
            "USER_MESSAGE",
            "FRIEND_REQUEST",
            name="notificationtype",
        ).create(bind, checkfirst=True)
        op.create_table(
            "notifications",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("recipient_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column(
                "notification_request_id",
                postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
            sa.Column("type", notification_type, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["recipient_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_notifications_recipient_read",
            "notifications",
            ["recipient_id", "is_read"],
        )

    # 3. Update messages table (is_delivered + team_id UUID)
    if "messages" in tables:
        msg_cols = {col["name"]: col for col in inspector.get_columns("messages")}
        if "is_delivered" not in msg_cols:
            op.add_column(
                "messages",
                sa.Column(
                    "is_delivered",
                    sa.Boolean(),
                    server_default=sa.false(),
                    nullable=False,
                ),
            )
            op.execute(
                sa.text(
                    "UPDATE messages "
                    "SET is_delivered = is_read "
                    "WHERE receiver_id IS NOT NULL AND team_id IS NULL"
                )
            )
            op.alter_column("messages", "is_delivered", server_default=None)

        team_col = msg_cols.get("team_id")
        if team_col is not None and not isinstance(team_col["type"], postgresql.UUID):
            for fk in inspector.get_foreign_keys("messages"):
                if "team_id" in (fk.get("constrained_columns") or []) and fk.get("name"):
                    op.drop_constraint(fk["name"], "messages", type_="foreignkey")
            for idx in inspector.get_indexes("messages"):
                if "team_id" in (idx.get("column_names") or []):
                    op.drop_index(idx["name"], table_name="messages")
            op.alter_column(
                "messages",
                "team_id",
                existing_type=sa.Integer(),
                type_=postgresql.UUID(as_uuid=True),
                existing_nullable=True,
                postgresql_using="NULL::uuid",
            )
            op.create_foreign_key(
                "fk_messages_team_id_workspace_teams",
                "messages",
                "workspace_teams",
                ["team_id"],
                ["id"],
                ondelete="CASCADE",
            )
            op.create_index("ix_messages_team_id", "messages", ["team_id"])

    # 4. Update workspace_teams (nullable opportunity_id + pitch_id)
    if "workspace_teams" in tables:
        wt_cols = {col["name"]: col for col in inspector.get_columns("workspace_teams")}
        op.alter_column(
            "workspace_teams",
            "opportunity_id",
            existing_type=postgresql.UUID(as_uuid=True),
            nullable=True,
        )
        if "pitch_id" not in wt_cols:
            op.add_column(
                "workspace_teams",
                sa.Column("pitch_id", postgresql.UUID(as_uuid=True), nullable=True),
            )
            op.create_foreign_key(
                "fk_workspace_teams_pitch_id_pitches",
                "workspace_teams",
                "pitches",
                ["pitch_id"],
                ["id"],
                ondelete="CASCADE",
            )
            op.create_unique_constraint(
                "uq_workspace_team_pitch",
                "workspace_teams",
                ["pitch_id"],
            )
            op.create_check_constraint(
                "ck_workspace_teams_exactly_one_owner",
                "workspace_teams",
                "(opportunity_id IS NOT NULL AND pitch_id IS NULL) OR "
                "(opportunity_id IS NULL AND pitch_id IS NOT NULL)",
            )

    # 5. Update workspace_team_members (add role column)
    if "workspace_team_members" in tables:
        wtm_cols = {col["name"]: col for col in inspector.get_columns("workspace_team_members")}
        if "role" not in wtm_cols:
            op.add_column(
                "workspace_team_members",
                sa.Column(
                    "role",
                    sa.String(length=20),
                    server_default="member",
                    nullable=False,
                ),
            )
            op.create_check_constraint(
                "ck_workspace_team_members_role",
                "workspace_team_members",
                "role IN ('admin', 'member')",
            )

    # 6. Repoint opportunities.project_id -> pitches.id and drop projects table
    if "opportunities" in tables:
        for fk in inspector.get_foreign_keys("opportunities"):
            if "project_id" in (fk.get("constrained_columns") or []) and fk.get("name"):
                op.drop_constraint(fk["name"], "opportunities", type_="foreignkey")
        op.create_foreign_key(
            "opportunities_project_id_fkey",
            "opportunities",
            "pitches",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )
    if "projects" in tables:
        op.drop_table("projects")

    # 7. Grant permissions on new tables to nexus_app if role exists
    op.execute(
        sa.text(
            "DO $$ BEGIN "
            "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexus_app') THEN "
            "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pitch_votes, notifications TO nexus_app; "
            "END IF; "
            "END $$;"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "workspace_team_members" in tables:
        wtm_cols = {col["name"]: col for col in inspector.get_columns("workspace_team_members")}
        if "role" in wtm_cols:
            op.drop_constraint(
                "ck_workspace_team_members_role",
                "workspace_team_members",
                type_="check",
            )
            op.drop_column("workspace_team_members", "role")

    if "workspace_teams" in tables:
        wt_cols = {col["name"]: col for col in inspector.get_columns("workspace_teams")}
        if "pitch_id" in wt_cols:
            op.drop_constraint(
                "ck_workspace_teams_exactly_one_owner",
                "workspace_teams",
                type_="check",
            )
            op.drop_constraint(
                "uq_workspace_team_pitch",
                "workspace_teams",
                type_="unique",
            )
            op.drop_constraint(
                "fk_workspace_teams_pitch_id_pitches",
                "workspace_teams",
                type_="foreignkey",
            )
            op.drop_column("workspace_teams", "pitch_id")

    if "messages" in tables:
        msg_cols = {col["name"]: col for col in inspector.get_columns("messages")}
        if "is_delivered" in msg_cols:
            op.drop_column("messages", "is_delivered")

    if "notifications" in tables:
        op.drop_index("ix_notifications_recipient_read", table_name="notifications")
        op.drop_table("notifications")
        notification_type.drop(bind, checkfirst=True)

    if "pitch_votes" in tables:
        op.drop_index("ix_pitch_votes_user_id", table_name="pitch_votes")
        op.drop_index("ix_pitch_votes_pitch_id", table_name="pitch_votes")
        op.drop_table("pitch_votes")

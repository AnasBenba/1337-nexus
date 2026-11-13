"""add pitch_votes, workspace_team_members, and uuid team_id on messages

Revision ID: 9f1a2b3c4d5e
Revises: 8e3a5f7c9d0b
Create Date: 2026-11-13 00:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "9f1a2b3c4d5e"
down_revision: Union[str, Sequence[str], None] = "8e3a5f7c9d0b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. Create pitch_votes table if not exists
    if not inspector.has_table("pitch_votes"):
        op.create_table(
            "pitch_votes",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("pitch_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("is_upvote", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(
                ["pitch_id"],
                ["pitches.id"],
                name="fk_pitch_votes_pitch_id_pitches",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                name="fk_pitch_votes_user_id_users",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("pitch_id", "user_id", name="uq_pitch_votes_pitch_user"),
        )
        op.create_index("ix_pitch_votes_pitch_id", "pitch_votes", ["pitch_id"], unique=False)
        op.create_index("ix_pitch_votes_user_id", "pitch_votes", ["user_id"], unique=False)

    # 2. Create workspace_team_members table if not exists
    if not inspector.has_table("workspace_team_members"):
        op.create_table(
            "workspace_team_members",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("role", sa.String(length=20), server_default="member", nullable=False),
            sa.Column("status", sa.String(length=20), server_default="accepted", nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["team_id"],
                ["workspace_teams.id"],
                name="fk_workspace_team_members_team_id",
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("team_id", "user_id", name="uq_workspace_team_member"),
        )
        op.create_index(
            "ix_workspace_team_members_team_id",
            "workspace_team_members",
            ["team_id"],
            unique=False,
        )
        op.create_index(
            "ix_workspace_team_members_user_id",
            "workspace_team_members",
            ["user_id"],
            unique=False,
        )
    else:
        wtm_cols = {c["name"] for c in inspector.get_columns("workspace_team_members")}
        if "role" not in wtm_cols:
            op.add_column(
                "workspace_team_members",
                sa.Column("role", sa.String(length=20), server_default="member", nullable=False),
            )
        if "status" not in wtm_cols:
            op.add_column(
                "workspace_team_members",
                sa.Column(
                    "status", sa.String(length=20), server_default="accepted", nullable=False
                ),
            )
        fks = {fk["name"] for fk in inspector.get_foreign_keys("workspace_team_members")}
        if "fk_workspace_team_members_user_id" in fks:
            op.drop_constraint(
                "fk_workspace_team_members_user_id",
                "workspace_team_members",
                type_="foreignkey",
            )

    # 3. Ensure messages.team_id is UUID
    if inspector.has_table("messages"):
        msg_cols = {c["name"]: c for c in inspector.get_columns("messages")}
        if "team_id" in msg_cols:
            col_type_str = str(msg_cols["team_id"]["type"]).upper()
            if "UUID" not in col_type_str:
                op.drop_column("messages", "team_id")
                op.add_column(
                    "messages",
                    sa.Column(
                        "team_id",
                        postgresql.UUID(as_uuid=True),
                        sa.ForeignKey("workspace_teams.id", ondelete="CASCADE"),
                        nullable=True,
                    ),
                )
                op.create_index("ix_messages_team_id", "messages", ["team_id"], unique=False)
        else:
            op.add_column(
                "messages",
                sa.Column(
                    "team_id",
                    postgresql.UUID(as_uuid=True),
                    sa.ForeignKey("workspace_teams.id", ondelete="CASCADE"),
                    nullable=True,
                ),
            )
            op.create_index("ix_messages_team_id", "messages", ["team_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if inspector.has_table("workspace_team_members"):
        op.drop_table("workspace_team_members")
    if inspector.has_table("pitch_votes"):
        op.drop_table("pitch_votes")

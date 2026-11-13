from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base


class WorkspaceTeam(Base):
    __tablename__ = "workspace_teams"
    __table_args__ = (
        UniqueConstraint(
            "opportunity_id",
            name="uq_workspace_team_opportunity",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    opportunity_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    founder_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    board: Mapped["WorkspaceBoard"] = relationship(
        back_populates="team",
        uselist=False,
        cascade="all, delete-orphan",
    )
    canvas: Mapped["WorkspaceCanvasDocument"] = relationship(
        back_populates="team",
        uselist=False,
        cascade="all, delete-orphan",
    )
    channel: Mapped["WorkspaceChannel"] = relationship(
        back_populates="team",
        uselist=False,
        cascade="all, delete-orphan",
    )
    members: Mapped[list["WorkspaceTeamMember"]] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
    )


class WorkspaceTeamMember(Base):
    __tablename__ = "workspace_team_members"
    __table_args__ = (
        UniqueConstraint(
            "team_id",
            "user_id",
            name="uq_workspace_team_member",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    team_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("workspace_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="member",
        server_default="member",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="accepted",
        server_default="accepted",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    team: Mapped[WorkspaceTeam] = relationship(back_populates="members")


class WorkspaceBoard(Base):
    __tablename__ = "workspace_boards"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    team_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("workspace_teams.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Main Board",
    )
    board_revision: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    team: Mapped[WorkspaceTeam] = relationship(back_populates="board")


class WorkspaceCanvasDocument(Base):
    __tablename__ = "workspace_canvas_documents"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    team_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("workspace_teams.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Main Canvas",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    team: Mapped[WorkspaceTeam] = relationship(back_populates="canvas")


class WorkspaceChannel(Base):
    __tablename__ = "workspace_channels"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    team_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("workspace_teams.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="general",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    team: Mapped[WorkspaceTeam] = relationship(back_populates="channel")

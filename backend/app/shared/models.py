from enum import Enum as PythonEnum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String, Text, UUID, func, Integer
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()

class ApplicationStatus(str, PythonEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

class UserRole(str, PythonEnum):
    STUDENT = "student"
    ADMIN = "admin"
    PARTNER = "partner"


class PitchStatus(str, PythonEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class Campus(Base):
    __tablename__ = "campuses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    users = relationship("User", back_populates="campus", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False)
    campus_id = Column(UUID(as_uuid=True), ForeignKey("campuses.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    campus = relationship("Campus", back_populates="users")
    pitches = relationship("Pitch", back_populates="author", cascade="all, delete-orphan")
    upvotes = relationship("PitchUpvote", back_populates="author", cascade="all, delete-orphan")
    applications = relationship("PitchApplication", back_populates="applicant", cascade="all, delete-orphan")
    teammem = relationship("TeamMember", back_populates="member", cascade="all, delete-orphan")


class Pitch(Base):
    __tablename__ = "pitches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    summary = Column(String(500))
    body = Column(Text, nullable=False)
    status = Column(Enum(PitchStatus, name="pitch_status"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    author = relationship("User", back_populates="pitches")
    upvotes = relationship("PitchUpvote", back_populates="pitches", cascade="all, delete-orphan")
    applications = relationship("PitchApplication", back_populates="pitch", cascade="all, delete-orphan")
    team = relationship("Team", back_populates="pitch", cascade="all, delete-orphan")
    @property
    def upvotes_count(self):
        return len(self.upvotes)

class PitchUpvote(Base):
    __tablename__ = "pitch_upvotes"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    pitch_id = Column(UUID(as_uuid=True), ForeignKey("pitches.id", ondelete="CASCADE"), primary_key=True)
    author = relationship("User", back_populates="upvotes")
    pitches = relationship("Pitch", back_populates="upvotes")

class PitchApplication(Base):
    __tablename__ = "pitches_application"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pitch_id = Column(UUID(as_uuid=True), ForeignKey("pitches.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=True)
    status = Column(Enum(ApplicationStatus, name="application_status"), nullable=False, default=ApplicationStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    applicant = relationship("User", back_populates="applications")
    pitch = relationship("Pitch", back_populates="applications")

class Team(Base):
    __tablename__ = "teams"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pitch_id = Column(UUID(as_uuid=True), ForeignKey("pitches.id", ondelete="CASCADE"), nullable=False)
    pitch = relationship("Pitch", back_populates="team")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")

class TeamMember(Base):
    __tablename__ = "team_members"
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    member = relationship("User", back_populates="teammem")
    team = relationship("Team", back_populates="members")
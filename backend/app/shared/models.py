from enum import Enum as PythonEnum

from sqlalchemy.orm import declarative_base

Base = declarative_base()


class UserRole(str, PythonEnum):
    STUDENT = "student"
    ADMIN = "admin"
    PARTNER = "partner"  ## just place holder


# NOTE: The models below are deprecated placeholders.
# The active User model is defined in app.oauth.user.Users.
#
# class Campus(Base):
#     __tablename__ = "campuses"
#
#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     name = Column(String(100), nullable=False)
#     city = Column(String(100), nullable=False)
#     users = relationship("User", back_populates="campus", cascade="all, delete-orphan")
#
#
# class User(Base):
#     __tablename__ = "users"
#
#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     email = Column(String(255), unique=True, nullable=False)
#     password_hash = Column(String(255), nullable=False)
#     display_name = Column(String(100), nullable=False)
#     role = Column(Enum(UserRole, name="user_role"), nullable=False)
#     campus_id = Column(UUID(as_uuid=True), ForeignKey("campuses.id"), nullable=False)
#     is_active = Column(Boolean, default=True, nullable=False)
#     created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
#     campus = relationship("Campus", back_populates="users")

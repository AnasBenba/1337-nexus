from enum import Enum as PythonEnum

from sqlalchemy.orm import declarative_base

Base = declarative_base()


class UserRole(str, PythonEnum):
    STUDENT = "student"
    ADMIN = "admin"
    PARTNER = "partner"


# The active User model is defined in app.oauth.user.Users.

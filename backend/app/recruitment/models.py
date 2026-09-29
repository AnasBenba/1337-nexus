"""Recruitment domain values.

Persistence mappings belong here once the shared SQLAlchemy Base and unit of
work are available. This module deliberately does not create its own database
base or engine.
"""

from enum import StrEnum


class ApplicationStatus(StrEnum):
    """Supported application lifecycle states."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class RecruitmentStatus(StrEnum):
    """Whether a recruitment post accepts new applications."""

    OPEN = "open"
    CLOSED = "closed"

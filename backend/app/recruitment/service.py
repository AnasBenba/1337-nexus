"""Recruitment domain rules, kept independent of HTTP and persistence."""

from app.recruitment.models import ApplicationStatus


class RecruitmentError(Exception):
    """Base error for recruitment use cases."""


class InvalidApplicationTransition(RecruitmentError):
    """Raised when an application cannot move to the requested state."""


_ALLOWED_APPLICATION_TRANSITIONS: dict[ApplicationStatus, frozenset[ApplicationStatus]] = {
    ApplicationStatus.PENDING: frozenset(
        {
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
        }
    ),
    ApplicationStatus.ACCEPTED: frozenset(),
    ApplicationStatus.REJECTED: frozenset(),
    ApplicationStatus.WITHDRAWN: frozenset(),
}


def transition_application(
    current: ApplicationStatus,
    requested: ApplicationStatus,
) -> ApplicationStatus:
    """Validate and return the next state for an application.

    This pure rule can be called from the future transactional service once
    the shared unit of work is present. No state is mutated here.
    """

    if requested not in _ALLOWED_APPLICATION_TRANSITIONS[current]:
        raise InvalidApplicationTransition(
            f"Cannot transition application from '{current.value}' to '{requested.value}'."
        )
    return requested

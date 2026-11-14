from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.oauth.permissions import permissions_for


class UserProfile(BaseModel):
    """Public profile returned by GET /users/me and GET /users/{login}."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    login: str
    fullname: str
    role: str
    intra_id: int | None
    bio: str | None
    avatar_url: str | None  # None = no upload; the frontend shows the default (initials) avatar


class MyProfile(UserProfile):
    """My own profile, plus what my role allows (the frontend shows/hides actions with it)."""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def permissions(self) -> list[str]:
        return sorted(permissions_for(self.role))


class UserSummary(BaseModel):
    """Small user card for lists (search results, friends)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    login: str
    fullname: str
    avatar_url: str | None


class ProfileUpdate(BaseModel):
    """Editable fields. Login and role come from 42 / admins and are not editable here."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    fullname: str = Field(min_length=1, max_length=100)
    bio: str = Field(default="", max_length=500)

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VoteDirection(str, Enum):
    UP = "up"
    DOWN = "down"


class PitchVoteRequest(BaseModel):
    direction: VoteDirection


class PitchVoteResponse(BaseModel):
    pitch_id: UUID
    upvotes: int
    downvotes: int
    my_vote: VoteDirection | None


class PitchStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    PENDING = "pending"


class PitchCategory(str, Enum):
    TECH = "Technology"
    HEALTH = "Health"
    BUSINESS = "Business"
    EDUCATION = "Education"
    ENVIRONMENT = "Environment"
    ENTERTAINMENT = "Entertainment"
    SOCIAL_IMPACT = "Social Impact"
    FINANCE = "Finance"
    FOOD_BEVERAGE = "Food & Beverage"
    FASHION_DESIGN = "Fashion & Design"


class PitchCreate(BaseModel):
    title: str
    content: str
    category: PitchCategory
    description: str | None = None


class PitchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    content: str
    rendered_content: str | None = None
    category: PitchCategory
    state: PitchStatus
    description: str | None = None
    author_id: UUID | None = None

from datetime import datetime
from enum import Enum
from typing import Any
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
    score: int = 0
    my_vote: VoteDirection | None = None


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
    status: PitchStatus | None = None


class PitchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    content: str
    rendered_content: str | None = None
    category: PitchCategory
    status: PitchStatus
    state: PitchStatus | None = None
    description: str | None = None
    author_id: UUID | None = None
    created_at: datetime | None = None
    upvotes: int = 0
    downvotes: int = 0
    score: int = 0
    my_vote: VoteDirection | None = None

    def model_post_init(self, __context: Any) -> None:
        if self.state is None:
            self.state = self.status

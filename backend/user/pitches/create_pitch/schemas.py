from enum import Enum
from uuid import UUID
from pydantic import BaseModel, Field

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
    title: str #= Field(min_length=10, max_length=30)
    content: str #= Field(min_length=50, max_length=400)
    category: PitchCategory
    description: str # = Field(default=None, max_length=200)


class PitchResponse(BaseModel):
    id: UUID    
    title: str
    content: str
    category: PitchCategory
    state: PitchStatus
    description: str = None
    # author_id: int
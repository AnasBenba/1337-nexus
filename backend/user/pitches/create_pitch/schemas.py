from enum import Enum
from pydantic import BaseModel, Field

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
    title: str = Field(min_length=10, max_length=30)
    content: str = Field(min_length=50, max_length=400)
    category: PitchCategory


class PitchResponse(BaseModel):
    id: int
    title: str
    content: str
    category: PitchCategory
    state: str
    author_id: int
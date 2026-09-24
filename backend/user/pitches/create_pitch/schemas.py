from pydantic import BaseModel

class PitchCreate(BaseModel):
    title: str
    content: str
    category: str


class PitchResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str
    state: str
    author_id: int
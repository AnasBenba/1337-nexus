from uuid import UUID

from pydantic import BaseModel, Field


class CreateColumnRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    board_revision: int = Field(ge=0)


class CreateCardRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    board_revision: int = Field(ge=0)
    before_card_id: UUID | None = None


class MoveCardRequest(BaseModel):
    destination_column_id: UUID
    board_revision: int = Field(ge=0)
    before_card_id: UUID | None = None


class DeleteColumnRequest(BaseModel):
    board_revision: int = Field(ge=0)


class ColumnResponse(BaseModel):
    id: UUID
    board_id: UUID
    name: str
    position: int

    model_config = {"from_attributes": True}


class CardResponse(BaseModel):
    id: UUID
    column_id: UUID
    title: str
    description: str | None
    rank: str

    model_config = {"from_attributes": True}


class ColumnDetailResponse(BaseModel):
    id: UUID
    board_id: UUID
    name: str
    position: int
    cards: list[CardResponse] = []

    model_config = {"from_attributes": True}


class BoardDetailResponse(BaseModel):
    id: UUID
    team_id: UUID
    name: str
    board_revision: int
    columns: list[ColumnDetailResponse] = []

    model_config = {"from_attributes": True}

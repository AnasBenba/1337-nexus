from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.user.dependencies import get_current_user

from .schemas import (
    CardResponse,
    ColumnResponse,
    CreateCardRequest,
    CreateColumnRequest,
    DeleteColumnRequest,
    MoveCardRequest,
)
from .service import (
    BoardRevisionConflict,
    create_board_card,
    create_board,
    create_board_column,
    delete_board_column,
    move_board_card,
)

router = APIRouter(prefix="/boards", tags=["boards"])


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create(
    team_id: UUID,
    name: str = "Main Board",
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> dict[str, object]:
    try:
        board = await create_board(
            db, team_id=team_id, name=name, user_id=current_user.id
        )
    except ValueError as error:
        raise _board_error(error) from error
    return {"id": board.id, "team_id": board.team_id, "name": board.name}


def _board_error(error: ValueError | PermissionError) -> HTTPException:
    if isinstance(error, PermissionError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, BoardRevisionConflict):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))


@router.post(
    "/{board_id}/columns",
    response_model=ColumnResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_column(
    board_id: UUID,
    request: CreateColumnRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> ColumnResponse:
    try:
        column = await create_board_column(
            db,
            board_id=board_id,
            name=request.name,
            expected_board_revision=request.board_revision,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise _board_error(error) from error
    return ColumnResponse.model_validate(column)


@router.delete("/{board_id}/columns/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(
    board_id: UUID,
    column_id: UUID,
    request: DeleteColumnRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> Response:
    try:
        await delete_board_column(
            db,
            column_id=column_id,
            board_id=board_id,
            expected_board_revision=request.board_revision,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise _board_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/columns/{column_id}/cards",
    response_model=CardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_card(
    column_id: UUID,
    request: CreateCardRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> CardResponse:
    try:
        card = await create_board_card(
            db,
            column_id=column_id,
            title=request.title,
            description=request.description,
            before_card_id=request.before_card_id,
            expected_board_revision=request.board_revision,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise _board_error(error) from error
    return CardResponse.model_validate(card)


@router.post("/{board_id}/cards/{card_id}/move", response_model=CardResponse)
async def move_card(
    board_id: UUID,
    card_id: UUID,
    request: MoveCardRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> CardResponse:
    try:
        card = await move_board_card(
            db,
            card_id=card_id,
            board_id=board_id,
            destination_column_id=request.destination_column_id,
            before_card_id=request.before_card_id,
            expected_board_revision=request.board_revision,
            user_id=current_user.id,
        )
    except ValueError as error:
        raise _board_error(error) from error
    return CardResponse.model_validate(card)

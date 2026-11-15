from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth.user import Users
from app.teams.models import WorkspaceBoard, WorkspaceTeam
from app.teams.provision_workspace.service import (
    provision_workspace,
    provision_workspace_for_pitch,
)
from app.user.dependencies import get_current_user
from app.user.opportunities.browse_opportunities.models import Opportunity
from app.user.pitches.models import Pitch

from .models import BoardCard, BoardColumn
from .schemas import (
    BoardDetailResponse,
    CardResponse,
    ColumnDetailResponse,
    ColumnResponse,
    CreateCardRequest,
    CreateColumnRequest,
    DeleteColumnRequest,
    MoveCardRequest,
)
from .service import (
    BoardRevisionConflict,
    create_board,
    create_board_card,
    create_board_column,
    delete_board_column,
    move_board_card,
)

router = APIRouter(prefix="/boards", tags=["boards"])


@router.get("/{board_id}", response_model=BoardDetailResponse)
async def get_board_detail(
    board_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> BoardDetailResponse:
    board = await db.scalar(select(WorkspaceBoard).where(WorkspaceBoard.id == board_id))
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    columns = list(
        (
            await db.scalars(
                select(BoardColumn)
                .where(BoardColumn.board_id == board_id)
                .order_by(BoardColumn.position)
            )
        ).all()
    )

    col_details = []
    for col in columns:
        cards = list(
            (
                await db.scalars(
                    select(BoardCard)
                    .where(BoardCard.column_id == col.id)
                    .order_by(BoardCard.rank)
                )
            ).all()
        )
        col_details.append(
            ColumnDetailResponse(
                id=col.id,
                board_id=col.board_id,
                name=col.name,
                position=col.position,
                cards=[CardResponse.model_validate(c) for c in cards],
            )
        )
    return BoardDetailResponse(
        id=board.id,
        team_id=board.team_id,
        name=board.name,
        board_revision=board.board_revision,
        columns=col_details,
    )


@router.get("/team/{team_id}", response_model=BoardDetailResponse)
async def get_team_board(
    team_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: Users = Depends(get_current_user),
) -> BoardDetailResponse:
    board = await db.scalar(select(WorkspaceBoard).where(WorkspaceBoard.team_id == team_id))

    if not board:
        # Check if team_id is an opportunity_id, pitch_id, or project_id with an existing team
        team = await db.scalar(
            select(WorkspaceTeam).where(
                (WorkspaceTeam.opportunity_id == team_id)
                | (WorkspaceTeam.pitch_id == team_id)
                | (
                    WorkspaceTeam.opportunity_id.in_(
                        select(Opportunity.id).where(Opportunity.project_id == team_id)
                    )
                )
            )
        )
        if team is not None:
            board = await db.scalar(
                select(WorkspaceBoard).where(WorkspaceBoard.team_id == team.id)
            )

    if not board:
        # If team_id is an Opportunity ID or a Pitch ID, auto-provision its workspace board
        opportunity = await db.get(Opportunity, team_id)
        pitch = await db.get(Pitch, team_id)
        if opportunity is not None:
            parent_pitch = await db.get(Pitch, opportunity.project_id)
            founder_id = (
                parent_pitch.author_id
                if parent_pitch is not None and parent_pitch.author_id is not None
                else current_user.id
            )
            provisioned = await provision_workspace(
                db,
                opportunity_id=opportunity.id,
                founder_id=founder_id,
            )
            board = provisioned.board
            board.name = f"{opportunity.title} Board"
            await db.commit()
        elif pitch is not None and pitch.author_id is not None:
            provisioned = await provision_workspace_for_pitch(db, pitch)
            board = provisioned.board
            board.name = f"{pitch.title} Board"
            await db.commit()

    if not board:
        raise HTTPException(status_code=404, detail="Board not found for this team")

    existing_cols = list(
        (
            await db.scalars(
                select(BoardColumn).where(BoardColumn.board_id == board.id)
            )
        ).all()
    )
    if not existing_cols:
        db.add_all(
            [
                BoardColumn(board_id=board.id, name="To Do", position=0),
                BoardColumn(board_id=board.id, name="In Progress", position=1),
                BoardColumn(board_id=board.id, name="Done", position=2),
            ]
        )
        await db.commit()

    return await get_board_detail(board_id=board.id, db=db, current_user=current_user)


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

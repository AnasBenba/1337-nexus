from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.teams.models import WorkspaceBoard

from .lexorank import RankSpaceExhausted, rank_between, rebalance_ranks
from .models import BoardCard, BoardColumn


class BoardRevisionConflict(ValueError):
    def __init__(self, expected: int, actual: int) -> None:
        super().__init__(
            f"Board revision conflict: expected {expected}, current revision is {actual}"
        )
        self.expected = expected
        self.actual = actual


class BoardValidationError(ValueError):
    pass


async def _lock_board(db: AsyncSession, board_id: UUID, expected_revision: int) -> WorkspaceBoard:
    board = await db.scalar(
        select(WorkspaceBoard).where(WorkspaceBoard.id == board_id).with_for_update()
    )
    if board is None:
        raise BoardValidationError("Board not found")
    if board.board_revision != expected_revision:
        raise BoardRevisionConflict(expected_revision, board.board_revision)
    return board


async def _bump_revision(db: AsyncSession, board: WorkspaceBoard) -> None:
    board.board_revision += 1
    await db.flush()


async def _column_cards(db: AsyncSession, column_id: UUID) -> list[BoardCard]:
    return list(
        (
            await db.scalars(
                select(BoardCard)
                .where(BoardCard.column_id == column_id)
                .order_by(BoardCard.rank)
                .with_for_update()
            )
        ).all()
    )


async def _rank_for_position(
    db: AsyncSession,
    column_id: UUID,
    before_card_id: UUID | None,
    moving_card_id: UUID | None = None,
) -> str:
    cards = [
        card
        for card in await _column_cards(db, column_id)
        if card.id != moving_card_id
    ]
    if before_card_id is None:
        before_index = len(cards)
    else:
        before_index = next(
            (index for index, card in enumerate(cards) if card.id == before_card_id),
            -1,
        )
        if before_index == -1:
            raise BoardValidationError("Before-card does not belong to the destination column")
    lower = cards[before_index - 1].rank if before_index else None
    upper = cards[before_index].rank if before_index < len(cards) else None
    try:
        return rank_between(lower, upper)
    except RankSpaceExhausted:
        rank_map = rebalance_ranks([card.rank for card in cards])
        for card in cards:
            card.rank = rank_map[card.rank]
        await db.flush()
        lower = cards[before_index - 1].rank if before_index else None
        upper = cards[before_index].rank if before_index < len(cards) else None
        return rank_between(lower, upper)


async def create_board_column(
    db: AsyncSession,
    *,
    board_id: UUID,
    name: str,
    expected_board_revision: int,
) -> BoardColumn:
    board = await _lock_board(db, board_id, expected_board_revision)
    max_position = await db.scalar(
        select(func.coalesce(func.max(BoardColumn.position), -1)).where(
            BoardColumn.board_id == board.id
        )
    )
    position = (max_position if max_position is not None else -1) + 1
    column = BoardColumn(board_id=board.id, name=name, position=position)
    db.add(column)
    await _bump_revision(db, board)
    await db.commit()
    await db.refresh(column)
    return column


async def create_board_card(
    db: AsyncSession,
    *,
    column_id: UUID,
    title: str,
    expected_board_revision: int,
    description: str | None = None,
    before_card_id: UUID | None = None,
) -> BoardCard:
    column = await db.scalar(select(BoardColumn).where(BoardColumn.id == column_id))
    if column is None:
        raise BoardValidationError("Column not found")
    board = await _lock_board(db, column.board_id, expected_board_revision)
    rank = await _rank_for_position(db, column.id, before_card_id)
    card = BoardCard(column_id=column.id, title=title, description=description, rank=rank)
    db.add(card)
    await _bump_revision(db, board)
    await db.commit()
    await db.refresh(card)
    return card


async def move_board_card(
    db: AsyncSession,
    *,
    card_id: UUID,
    destination_column_id: UUID,
    expected_board_revision: int,
    before_card_id: UUID | None = None,
    board_id: UUID | None = None,
) -> BoardCard:
    card = await db.scalar(select(BoardCard).where(BoardCard.id == card_id))
    destination = await db.scalar(
        select(BoardColumn).where(BoardColumn.id == destination_column_id)
    )
    if card is None or destination is None:
        raise BoardValidationError("Card or destination column not found")
    source = await db.scalar(select(BoardColumn).where(BoardColumn.id == card.column_id))
    if source is None or source.board_id != destination.board_id:
        raise BoardValidationError("Card and destination must belong to the same board")
    if board_id is not None and destination.board_id != board_id:
        raise BoardValidationError("Card does not belong to the requested board")
    board = await _lock_board(db, destination.board_id, expected_board_revision)
    card.rank = await _rank_for_position(
        db, destination.id, before_card_id, moving_card_id=card.id
    )
    card.column_id = destination.id
    await _bump_revision(db, board)
    await db.commit()
    await db.refresh(card)
    return card


async def delete_board_column(
    db: AsyncSession,
    *,
    column_id: UUID,
    expected_board_revision: int,
    board_id: UUID | None = None,
) -> None:
    column = await db.scalar(select(BoardColumn).where(BoardColumn.id == column_id))
    if column is None:
        raise BoardValidationError("Column not found")
    if board_id is not None and column.board_id != board_id:
        raise BoardValidationError("Column does not belong to the requested board")
    board = await _lock_board(db, column.board_id, expected_board_revision)
    column_count = await db.scalar(
        select(func.count(BoardColumn.id)).where(BoardColumn.board_id == board.id)
    )
    if column_count is None or column_count <= 1:
        raise BoardValidationError("A board must retain at least one column")
    card_count = await db.scalar(
        select(func.count(BoardCard.id)).where(BoardCard.column_id == column.id)
    )
    if card_count:
        raise BoardValidationError("A column must be empty before it can be deleted")
    await db.delete(column)
    await _bump_revision(db, board)
    await db.commit()

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.collaboration.board.lexorank import RankSpaceExhausted, rank_between, rebalance_ranks
from app.collaboration.board.models import BoardCard
from app.collaboration.board.service import (
    BoardRevisionConflict,
    create_board_column,
    move_board_card,
)
from app.teams.models import WorkspaceBoard


def test_lexorank_is_deterministic_and_strictly_ordered() -> None:
    first = rank_between(None, None)
    second = rank_between(first, None)
    middle = rank_between(first, second)

    assert first < middle < second
    assert rank_between(first, second) == middle


def test_rebalance_preserves_order_and_creates_space() -> None:
    old_ranks = ["00000000000000000001", "00000000000000000002"]
    new_ranks = rebalance_ranks(old_ranks)

    assert list(new_ranks) == old_ranks
    assert new_ranks[old_ranks[0]] < new_ranks[old_ranks[1]]
    assert rank_between(new_ranks[old_ranks[0]], new_ranks[old_ranks[1]])


def test_card_rank_uses_c_collation() -> None:
    assert BoardCard.__table__.c.rank.type.collation == "C"


@pytest.mark.asyncio
async def test_create_column_requires_exact_board_revision() -> None:
    board = WorkspaceBoard(team_id=uuid4(), board_revision=4)
    db = MagicMock()
    db.scalar = AsyncMock(return_value=board)

    with pytest.raises(BoardRevisionConflict, match="expected 3"):
        await create_board_column(
            db,
            board_id=board.id,
            name="Doing",
            expected_board_revision=3,
        )

    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_create_column_increments_board_revision() -> None:
    board = WorkspaceBoard(team_id=uuid4(), board_revision=4)
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[board, 0])
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    column = await create_board_column(
        db,
        board_id=board.id,
        name="Doing",
        expected_board_revision=4,
    )

    assert column.board_id == board.id
    assert column.position == 1
    assert board.board_revision == 5
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_move_card_rejects_card_from_another_board() -> None:
    first_board = WorkspaceBoard(id=uuid4(), team_id=uuid4(), board_revision=0)
    second_board = WorkspaceBoard(id=uuid4(), team_id=uuid4(), board_revision=0)
    source = MagicMock(board_id=first_board.id)
    destination = MagicMock(board_id=second_board.id)
    card = MagicMock(column_id=source.id)
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[card, destination, source])

    with pytest.raises(ValueError, match="same board"):
        await move_board_card(
            db,
            card_id=uuid4(),
            destination_column_id=destination.id,
            expected_board_revision=0,
        )

    db.commit.assert_not_called()


def test_rank_space_exhaustion_is_explicit() -> None:
    with pytest.raises(RankSpaceExhausted):
        rank_between("00000000000000000000", "00000000000000000000")

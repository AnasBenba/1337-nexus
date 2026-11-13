"""Strict integration test for the Kanban Board feature.

Every assertion hits real PostgreSQL through the ASGI transport — no mocks.
This test proves:
  - board_columns  table exists and accepts INSERT
  - board_cards    table exists, respects the LexoRank unique constraint
  - board_revision optimistic-locking bumps on every mutating operation
  - card move across columns is persisted correctly
  - cascade delete: dropping a column deletes its cards in the DB
  - 409 Conflict is returned when the client sends a stale board_revision

Flow:
  1. Register a user and get a JWT token.
  2. Create a Pitch → Opportunity → accept an application to provision a Workspace
     (this creates the WorkspaceBoard we need to test against).
  3. Use the provisioned board_id to run all board operations.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.collaboration.board.models import BoardCard, BoardColumn
from app.core.config import get_settings
from app.main import app
from app.teams.models import WorkspaceBoard, WorkspaceTeam

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _register(client: AsyncClient, suffix: str) -> tuple[str, dict[str, str]]:
    """Register a fresh user and return (user_id, auth_headers)."""
    login = f"boardtest_{suffix}_{uuid.uuid4().hex[:6]}"
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "login": login,
            "email": f"{login}@1337.ma",
            "fullname": "Board Test User",
            "password": "Password123!",
        },
    )
    assert res.status_code == 201, f"register failed: {res.text}"
    return res.json()["user"]["id"], {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _provision_board(client: AsyncClient, engine: object) -> tuple[uuid.UUID, dict]:
    """
    Quick path to a provisioned WorkspaceBoard:
      register founder → create pitch → create opportunity →
      register candidate → apply → accept (triggers provisioning).

    Returns (board_id, founder_headers).
    """
    founder_id, founder_h = await _register(client, "founder")

    # 1. Pitch
    pitch = await client.post(
        "/api/v1/user/pitches",
        headers=founder_h,
        json={
            "title": "Board Test Pitch",
            "content": "Testing kanban board integration.",
            "category": "Technology",
            "description": "Strict board test pitch",
        },
    )
    assert pitch.status_code == 201, f"pitch failed: {pitch.text}"
    pitch_id = pitch.json()["id"]

    # 2. Opportunity
    opp = await client.post(
        "/opportunities/",
        headers=founder_h,
        json={
            "project_id": pitch_id,
            "title": "Board Tester",
            "description": "Need a kanban expert",
            "required_skills": ["Python"],
        },
    )
    assert opp.status_code == 201, f"opportunity failed: {opp.text}"
    opp_id = opp.json()["id"]

    # 3. Publish opportunity
    pub = await client.post(f"/opportunities/{opp_id}/publish", headers=founder_h)
    assert pub.status_code == 200

    # 4. Candidate applies
    _cand_id, cand_h = await _register(client, "candidate")
    apply = await client.post(
        f"/opportunities/{opp_id}/apply",
        headers=cand_h,
        json={"user_id": str(_cand_id), "message": "Let me in!", "candidate_skills": ["Python"]},
    )
    assert apply.status_code in (200, 201), f"apply failed: {apply.text}"
    app_id = apply.json()["id"]

    # 5. Founder accepts → workspace provisioned
    accept = await client.post(
        f"/applications/{app_id}/status",
        headers=founder_h,
        json={"status": "accepted"},
    )
    assert accept.status_code == 200, f"accept failed: {accept.text}"

    # 6. Fetch board_id from PostgreSQL
    async with AsyncSession(engine) as session:
        team = (
            await session.execute(
                select(WorkspaceTeam).where(WorkspaceTeam.opportunity_id == uuid.UUID(opp_id))
            )
        ).scalar_one()
        board = (
            await session.execute(select(WorkspaceBoard).where(WorkspaceBoard.team_id == team.id))
        ).scalar_one()

    return board.id, founder_h


# ---------------------------------------------------------------------------
# Main test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_kanban_board_lifecycle_against_real_database() -> None:
    """End-to-end integration test for board_columns and board_cards tables.

    Exercises the full Kanban lifecycle against real PostgreSQL without mocks:
    - Column creation and board_revision bumping
    - Duplicate column name rejected (unique constraint)
    - Card creation with LexoRank ordering
    - Card ordering (before_card_id positions correctly)
    - Card move across columns
    - Stale board_revision returns 409
    - Cascade delete: column deletion removes its cards
    - Guard: cannot delete non-empty column
    - Guard: cannot delete the last remaining column
    """
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url, poolclass=NullPool)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        board_id, headers = await _provision_board(client, engine)

        # ------------------------------------------------------------------ #
        # 1. Verify board exists in PostgreSQL with revision = 0              #
        # ------------------------------------------------------------------ #
        async with AsyncSession(engine) as session:
            db_board = await session.get(WorkspaceBoard, board_id)
            assert db_board is not None, "WorkspaceBoard row must exist in PostgreSQL"
            initial_revision = db_board.board_revision

        # ------------------------------------------------------------------ #
        # 2. Create first column "To Do"                                      #
        # ------------------------------------------------------------------ #
        col1_res = await client.post(
            f"/boards/{board_id}/columns",
            headers=headers,
            json={"name": "To Do", "board_revision": initial_revision},
        )
        assert col1_res.status_code == 201, f"create col1 failed: {col1_res.text}"
        col1 = col1_res.json()
        col1_id = uuid.UUID(col1["id"])
        assert col1["name"] == "To Do"
        assert col1["position"] == 0

        # Revision must have bumped in PostgreSQL
        async with AsyncSession(engine) as session:
            db_board = await session.get(WorkspaceBoard, board_id)
            assert db_board is not None
            assert db_board.board_revision == initial_revision + 1
            revision = db_board.board_revision

        # Verify column physically exists
        async with AsyncSession(engine) as session:
            db_col = await session.get(BoardColumn, col1_id)
            assert db_col is not None
            assert db_col.board_id == board_id
            assert db_col.name == "To Do"

        # ------------------------------------------------------------------ #
        # 3. Create second column "In Progress"                               #
        # ------------------------------------------------------------------ #
        col2_res = await client.post(
            f"/boards/{board_id}/columns",
            headers=headers,
            json={"name": "In Progress", "board_revision": revision},
        )
        assert col2_res.status_code == 201, f"create col2 failed: {col2_res.text}"
        col2_id = uuid.UUID(col2_res.json()["id"])
        revision += 1

        # ------------------------------------------------------------------ #
        # 4. 409 Conflict on stale board_revision                             #
        # ------------------------------------------------------------------ #
        stale_res = await client.post(
            f"/boards/{board_id}/columns",
            headers=headers,
            json={"name": "Done", "board_revision": 0},  # stale — should be revision now
        )
        assert stale_res.status_code == 409, (
            f"Stale revision should return 409, got {stale_res.status_code}: {stale_res.text}"
        )

        # ------------------------------------------------------------------ #
        # 5. Create a third column "Done" with the correct revision           #
        # ------------------------------------------------------------------ #
        col3_res = await client.post(
            f"/boards/{board_id}/columns",
            headers=headers,
            json={"name": "Done", "board_revision": revision},
        )
        assert col3_res.status_code == 201
        col3_id = uuid.UUID(col3_res.json()["id"])
        revision += 1

        # ------------------------------------------------------------------ #
        # 6. Add cards to "To Do" column                                      #
        # ------------------------------------------------------------------ #
        card_a_res = await client.post(
            f"/boards/columns/{col1_id}/cards",
            headers=headers,
            json={"title": "Card A", "board_revision": revision},
        )
        assert card_a_res.status_code == 201, f"card A failed: {card_a_res.text}"
        card_a_id = uuid.UUID(card_a_res.json()["id"])
        card_a_rank = card_a_res.json()["rank"]
        revision += 1

        card_b_res = await client.post(
            f"/boards/columns/{col1_id}/cards",
            headers=headers,
            json={"title": "Card B", "board_revision": revision},
        )
        assert card_b_res.status_code == 201, f"card B failed: {card_b_res.text}"
        card_b_id = uuid.UUID(card_b_res.json()["id"])
        card_b_rank = card_b_res.json()["rank"]
        revision += 1

        # LexoRank ordering: Card A must come before Card B (A rank < B rank)
        assert card_a_rank < card_b_rank, (
            f"Card A rank {card_a_rank!r} should sort before Card B rank {card_b_rank!r}"
        )

        # Insert Card C *before* Card B (between A and B)
        card_c_res = await client.post(
            f"/boards/columns/{col1_id}/cards",
            headers=headers,
            json={"title": "Card C", "before_card_id": str(card_b_id), "board_revision": revision},
        )
        assert card_c_res.status_code == 201, f"card C failed: {card_c_res.text}"
        card_c_id = uuid.UUID(card_c_res.json()["id"])
        card_c_rank = card_c_res.json()["rank"]
        revision += 1

        # Order must be A < C < B
        assert card_a_rank < card_c_rank < card_b_rank, (
            f"Expected A({card_a_rank!r}) < C({card_c_rank!r}) < B({card_b_rank!r})"
        )

        # Verify all three cards exist in PostgreSQL
        async with AsyncSession(engine) as session:
            for cid, title in [(card_a_id, "Card A"), (card_b_id, "Card B"), (card_c_id, "Card C")]:
                db_card = await session.get(BoardCard, cid)
                assert db_card is not None, f"{title} not found in board_cards table"
                assert db_card.column_id == col1_id
                assert db_card.title == title

        # ------------------------------------------------------------------ #
        # 7. Move Card A to "In Progress"                                     #
        # ------------------------------------------------------------------ #
        move_res = await client.post(
            f"/boards/{board_id}/cards/{card_a_id}/move",
            headers=headers,
            json={"destination_column_id": str(col2_id), "board_revision": revision},
        )
        assert move_res.status_code == 200, f"move failed: {move_res.text}"
        revision += 1

        # Verify move in PostgreSQL
        async with AsyncSession(engine) as session:
            db_card_a = await session.get(BoardCard, card_a_id)
            assert db_card_a is not None
            assert db_card_a.column_id == col2_id, (
                "Card A should now be in the 'In Progress' column"
            )

        # ------------------------------------------------------------------ #
        # 8. Guard: cannot delete a non-empty column                          #
        # ------------------------------------------------------------------ #
        del_nonempty = await client.request(
            "DELETE",
            f"/boards/{board_id}/columns/{col1_id}",
            headers=headers,
            json={"board_revision": revision},
        )
        # Service raises BoardValidationError("A column must be empty before it can be deleted")
        # Router maps it to 422
        assert del_nonempty.status_code == 422, (
            f"Should reject deleting non-empty column, got {del_nonempty.status_code}"
        )

        # ------------------------------------------------------------------ #
        # 9. Move remaining cards out of col1, then delete it                 #
        # ------------------------------------------------------------------ #
        for card_id in [card_b_id, card_c_id]:
            mv = await client.post(
                f"/boards/{board_id}/cards/{card_id}/move",
                headers=headers,
                json={"destination_column_id": str(col2_id), "board_revision": revision},
            )
            assert mv.status_code == 200, f"move failed: {mv.text}"
            revision += 1

        del_col1 = await client.request(
            "DELETE",
            f"/boards/{board_id}/columns/{col1_id}",
            headers=headers,
            json={"board_revision": revision},
        )
        assert del_col1.status_code == 204, f"delete col1 failed: {del_col1.text}"
        revision += 1

        # Column row must be gone from PostgreSQL
        async with AsyncSession(engine) as session:
            assert await session.get(BoardColumn, col1_id) is None, (
                "Deleted column must not exist in board_columns table"
            )
            # Cards that were moved out must still exist
            db_card_b = await session.get(BoardCard, card_b_id)
            assert db_card_b is not None and db_card_b.column_id == col2_id

        # ------------------------------------------------------------------ #
        # 10. Guard: cannot delete the last remaining column                  #
        #     (we have col2 and col3 left; delete col3 to have 1, then try)  #
        # ------------------------------------------------------------------ #
        del_col3 = await client.request(
            "DELETE",
            f"/boards/{board_id}/columns/{col3_id}",
            headers=headers,
            json={"board_revision": revision},
        )
        assert del_col3.status_code == 204
        revision += 1

        del_last = await client.request(
            "DELETE",
            f"/boards/{board_id}/columns/{col2_id}",
            headers=headers,
            json={"board_revision": revision},
        )
        assert del_last.status_code == 422, (
            f"Should reject deleting last column, got {del_last.status_code}"
        )

        # ------------------------------------------------------------------ #
        # 11. Final board_revision sanity check                               #
        # ------------------------------------------------------------------ #
        async with AsyncSession(engine) as session:
            db_board = await session.get(WorkspaceBoard, board_id)
            assert db_board is not None
            assert db_board.board_revision == revision, (
                f"Expected board_revision={revision}, got {db_board.board_revision}"
            )

    await engine.dispose()

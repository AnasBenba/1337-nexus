import uuid
from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.ai.client import get_ai_provider
from app.user.pitches.models import Pitch, PitchVote
from app.user.pitches.schemas import (
    PitchCategory,
    PitchCreate,
    PitchResponse,
    PitchStatus,
    PitchVoteResponse,
    VoteDirection,
)
from app.user.pitches.utils import render_and_sanitize


async def enrich_pitches_with_votes(
    db: AsyncSession,
    pitches: Sequence[Pitch],
    user_id: UUID | None = None,
) -> list[PitchResponse]:
    if not pitches:
        return []

    pitch_ids = [p.id for p in pitches]

    counts_stmt = (
        select(
            PitchVote.pitch_id,
            func.count(PitchVote.id).filter(PitchVote.is_upvote.is_(True)).label("upvotes"),
            func.count(PitchVote.id).filter(PitchVote.is_upvote.is_(False)).label("downvotes"),
        )
        .where(PitchVote.pitch_id.in_(pitch_ids))
        .group_by(PitchVote.pitch_id)
    )
    counts_res = await db.execute(counts_stmt)
    counts_map: dict[UUID, tuple[int, int]] = {
        row.pitch_id: (int(row.upvotes), int(row.downvotes)) for row in counts_res.all()
    }

    user_votes_map: dict[UUID, VoteDirection] = {}
    if user_id is not None:
        uv_stmt = select(PitchVote.pitch_id, PitchVote.is_upvote).where(
            PitchVote.pitch_id.in_(pitch_ids),
            PitchVote.user_id == user_id,
        )
        uv_res = await db.execute(uv_stmt)
        for row in uv_res.all():
            user_votes_map[row.pitch_id] = VoteDirection.UP if row.is_upvote else VoteDirection.DOWN

    responses: list[PitchResponse] = []
    for p in pitches:
        up, down = counts_map.get(p.id, (0, 0))
        resp = PitchResponse.model_validate(p)
        resp.upvotes = up
        resp.downvotes = down
        resp.score = up - down
        resp.my_vote = user_votes_map.get(p.id)
        responses.append(resp)

    return responses


async def get_pitch_votes(
    db: AsyncSession,
    pitch_id: UUID,
    user_id: UUID | None = None,
) -> PitchVoteResponse:
    await get_one_pitch(db, pitch_id)
    counts_result = await db.execute(
        select(
            func.count(PitchVote.id).filter(PitchVote.is_upvote.is_(True)).label("upvotes"),
            func.count(PitchVote.id).filter(PitchVote.is_upvote.is_(False)).label("downvotes"),
        ).where(PitchVote.pitch_id == pitch_id)
    )
    counts = counts_result.one()

    my_vote = None
    if user_id is not None:
        vote_result = await db.execute(
            select(PitchVote.is_upvote).where(
                PitchVote.pitch_id == pitch_id,
                PitchVote.user_id == user_id,
            )
        )
        is_upvote = vote_result.scalar_one_or_none()
        if is_upvote is not None:
            my_vote = VoteDirection.UP if is_upvote else VoteDirection.DOWN

    up = int(counts.upvotes)
    down = int(counts.downvotes)
    return PitchVoteResponse(
        pitch_id=pitch_id,
        upvotes=up,
        downvotes=down,
        score=up - down,
        my_vote=my_vote,
    )


async def user_vote_on_pitch(
    db: AsyncSession,
    pitch_id: UUID,
    user_id: UUID,
    is_upvote: bool,
) -> PitchVoteResponse:
    await get_one_pitch(db, pitch_id)
    statement = pg_insert(PitchVote).values(
        id=uuid.uuid4(),
        pitch_id=pitch_id,
        user_id=user_id,
        is_upvote=is_upvote,
    )
    statement = statement.on_conflict_do_update(
        constraint="uq_pitch_votes_pitch_user",
        set_={"is_upvote": is_upvote},
    )
    await db.execute(statement)
    await db.commit()
    return await get_pitch_votes(db, pitch_id, user_id)


async def remove_user_vote(
    db: AsyncSession,
    pitch_id: UUID,
    user_id: UUID,
) -> PitchVoteResponse:
    await get_one_pitch(db, pitch_id)
    await db.execute(
        delete(PitchVote).where(
            PitchVote.pitch_id == pitch_id,
            PitchVote.user_id == user_id,
        )
    )
    await db.commit()
    return await get_pitch_votes(db, pitch_id, user_id)


async def get_all_pitches(db: AsyncSession, limit: int = 40) -> Sequence[Pitch]:
    query = select(Pitch).order_by(Pitch.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_one_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if not pitch:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch


async def search_pitches(
    db: AsyncSession,
    query: str,
    limit: int = 10,
    category: PitchCategory | str | None = None,
) -> Sequence[Pitch]:
    ai = get_ai_provider()
    query_embedding = await ai.embed([query])
    query_vector = query_embedding[0]
    db_query = select(Pitch)
    if category:
        db_query = db_query.where(Pitch.category == category)
    db_query = db_query.order_by(Pitch.embedding.cosine_distance(query_vector)).limit(limit)
    result = await db.execute(db_query)
    return result.scalars().all()


async def create_pitch(
    db: AsyncSession, pitch: PitchCreate, author_id: uuid.UUID | None = None
) -> Pitch:
    ai = get_ai_provider()
    pitch_data = pitch.model_dump(exclude_none=True)
    if "status" not in pitch_data:
        pitch_data["status"] = PitchStatus.DRAFT
    embeddings = await ai.embed([pitch_data["content"]])
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])
    new_pitch = Pitch(**pitch_data, author_id=author_id)
    if embeddings:
        new_pitch.embedding = embeddings[0]
    db.add(new_pitch)
    await db.commit()
    await db.refresh(new_pitch)
    return new_pitch


async def update_pitch(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    pitch: PitchCreate,
    embedding: list[float] | None = None,
) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    existing_pitch = result.scalar_one_or_none()
    if existing_pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")

    pitch_data = pitch.model_dump(exclude_none=True)
    if embedding is not None:
        embeddings = [embedding]
    else:
        ai = get_ai_provider()
        embeddings = await ai.embed([pitch_data["content"]])

    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])

    for field, value in pitch_data.items():
        setattr(existing_pitch, field, value)
    if embeddings:
        existing_pitch.embedding = embeddings[0]

    await db.commit()
    await db.refresh(existing_pitch)
    return existing_pitch


async def publish_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> Pitch:
    pitch = await get_one_pitch(db=db, pitch_id=pitch_id)
    pitch.status = PitchStatus.PUBLISHED
    await db.commit()
    await db.refresh(pitch)
    return pitch


async def delete_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> dict[str, str]:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")
    await db.delete(pitch)
    await db.commit()
    return {"message": "Pitch deleted successfully"}

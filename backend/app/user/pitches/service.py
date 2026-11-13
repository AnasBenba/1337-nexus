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
    PitchCreate,
    PitchVoteResponse,
    VoteDirection,
)
from app.user.pitches.utils import render_and_sanitize


async def get_pitch_votes(
    db: AsyncSession,
    pitch_id: UUID,
    user_id: UUID | None = None,
) -> PitchVoteResponse:
    await get_one_pitch(db, pitch_id)
    counts_result = await db.execute(
        select(
            func.count(PitchVote.id)
            .filter(PitchVote.is_upvote.is_(True))
            .label("upvotes"),
            func.count(PitchVote.id)
            .filter(PitchVote.is_upvote.is_(False))
            .label("downvotes"),
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

    return PitchVoteResponse(
        pitch_id=pitch_id,
        upvotes=counts.upvotes,
        downvotes=counts.downvotes,
        my_vote=my_vote,
    )


async def get_user_vote(
    db: AsyncSession,
    pitch_id: UUID,
    user_id: UUID,
) -> dict[str, bool | None]:
    await get_one_pitch(db, pitch_id)
    result = await db.execute(
        select(PitchVote.is_upvote).where(
            PitchVote.pitch_id == pitch_id,
            PitchVote.user_id == user_id,
        )
    )
    is_upvote = result.scalar_one_or_none()
    if is_upvote is None:
        return {"has_voted": False, "is_upvote": None}
    return {"has_voted": True, "is_upvote": is_upvote}


async def user_vote_on_pitch(
    db: AsyncSession,
    pitch_id: UUID,
    user_id: UUID,
    is_upvote: bool,
) -> PitchVoteResponse:
    await get_one_pitch(db, pitch_id)
    statement = pg_insert(PitchVote).values(
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


async def search_pitches(
    db: AsyncSession,
    query: str,
    limit: int = 10,
    category: str | None = None,
) -> list[Pitch]:
    ai = get_ai_provider()
    query_embedding = await ai.embed([query])
    db_query = select(Pitch)
    if category:
        db_query = db_query.where(Pitch.category == category)
    db_query = db_query.order_by(
        Pitch.embedding.cosine_distance(query_embedding[0])
    ).limit(limit)
    result = await db.execute(db_query)
    return list(result.scalars().all())


async def create_pitch(
    db: AsyncSession,
    pitch: PitchCreate,
    author_id: UUID,
) -> Pitch:
    ai = get_ai_provider()
    pitch_data = pitch.model_dump()
    embeddings = await ai.embed([pitch_data["content"]])
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])

    new_pitch = Pitch(**pitch_data, author_id=author_id)
    new_pitch.embedding = embeddings[0]
    db.add(new_pitch)
    await db.commit()
    await db.refresh(new_pitch)
    return new_pitch


async def get_all_pitches(db: AsyncSession) -> list[Pitch]:
    query = select(Pitch).order_by(Pitch.created_at.desc()).limit(40)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_one_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> Pitch:
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if pitch is None:
        raise HTTPException(status_code=404, detail="Pitch not found")
    return pitch


async def delete_pitch(db: AsyncSession, pitch_id: uuid.UUID) -> dict[str, str]:
    pitch = await get_one_pitch(db=db, pitch_id=pitch_id)
    await db.delete(pitch)
    await db.commit()
    return {"message": "Pitch deleted successfully"}


async def update_pitch(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    pitch: PitchCreate,
    embedding: list[float] | None = None,
) -> Pitch:
    existing_pitch = await get_one_pitch(db=db, pitch_id=pitch_id)

    if embedding is None:
        ai = get_ai_provider()
        embeddings = await ai.embed([pitch.content])
        embedding = embeddings[0]

    pitch_data = pitch.model_dump()
    pitch_data["rendered_content"] = render_and_sanitize(pitch_data["content"])
    if "status" not in pitch.model_fields_set:
        pitch_data.pop("status")

    for field, value in pitch_data.items():
        setattr(existing_pitch, field, value)
    existing_pitch.embedding = embedding

    await db.commit()
    await db.refresh(existing_pitch)
    return existing_pitch

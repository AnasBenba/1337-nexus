import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.jobs.service import enqueue_job
from app.models.job import AIJob
from app.models.suggestion import PitchCritique, PitchSuggestion
from app.oauth.user import Users
from app.shared.ai.client import get_ai_provider
from app.user.pitches.models import Pitch
from app.user.pitches.schemas import PitchCreate
from app.user.pitches.service import update_pitch
from app.user.projects.refine_project.schemas import (
    ApplySuggestionResponse,
    CritiqueSummary,
    DismissSuggestionResponse,
    RefineResponse,
    RefineStatusResponse,
    SuggestionItem,
)


def compute_pitch_hash(title: str, description: str | None, content: str) -> str:
    """
    Canonical content hash (SHA-256) of pitch snapshot.
    Normalizes \r\n to \n before hashing for cross-platform stability.
    """
    norm_title = (title or "").replace("\r\n", "\n").strip()
    norm_desc = (description or "").replace("\r\n", "\n").strip()
    norm_content = (content or "").replace("\r\n", "\n").strip()
    payload = f"{norm_title}\n---\n{norm_desc}\n---\n{norm_content}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def check_pitch_authorization(pitch: Pitch, current_user: Users) -> None:
    """
    Check if the user is authorized to refine/update the pitch.
    Rules:
    - Author (pitch.author_id == current_user.id) has full access.
    - Superuser / admin has full access.
    - Otherwise, 403 Forbidden.
    """
    is_admin = (
        getattr(current_user, "is_superuser", False)
        or getattr(current_user, "is_admin", False)
        or getattr(current_user, "role", "") == "admin"
    )
    if is_admin:
        return
    if pitch.author_id is not None and pitch.author_id == current_user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not authorized to refine or modify this pitch",
    )


async def request_pitch_refinement(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    current_user: Users,
) -> RefineResponse:
    """
    Initiate an AI critique workflow for a pitch.
    Idempotent: if a critique job is already queued/running for the identical content hash,
    returns the existing job_id without duplicate enqueueing.
    """
    # 1. Fetch pitch
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if pitch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pitch not found",
        )

    # 2. Authorize
    check_pitch_authorization(pitch, current_user)

    # 3. Guard: only DRAFT status can be refined
    status_str = str(pitch.status.value if hasattr(pitch.status, "value") else pitch.status).lower()
    if status_str != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only draft pitches can be refined (current status: {pitch.status})",
        )

    # 4. Guard: require minimum content
    if not (pitch.content and pitch.content.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pitch content cannot be empty",
        )

    # 5. Compute canonical hash
    content_hash = compute_pitch_hash(pitch.title, pitch.description, pitch.content)

    # 6. Check existing active job (queued or running) with same pitch_id and base_hash
    jobs_stmt = (
        select(AIJob)
        .where(
            AIJob.job_type == "pitch.refine",
            AIJob.status.in_(["pending", "queued", "running"]),
        )
        .order_by(AIJob.created_at.desc())
    )
    active_jobs = (await db.execute(jobs_stmt)).scalars().all()
    for job in active_jobs:
        payload = job.payload or {}
        if payload.get("pitch_id") == str(pitch_id) and payload.get("base_hash") == content_hash:
            return RefineResponse(
                job_id=job.id,
                status=job.status,
                base_hash=content_hash,
                message="A refinement job for this exact pitch version is already in progress",
            )

    # 7. Snapshot and enqueue new job
    snapshot_payload = {
        "pitch_id": str(pitch.id),
        "author_id": current_user.id,
        "title": pitch.title,
        "description": pitch.description,
        "content": pitch.content,
        "base_hash": content_hash,
    }

    job = await enqueue_job(
        session=db,
        job_type="pitch.refine",
        payload=snapshot_payload,
    )
    snapshot_payload["job_id"] = str(job.id)
    job.payload = dict(snapshot_payload)
    flag_modified(job, "payload")
    await db.commit()

    return RefineResponse(
        job_id=job.id,
        status="queued",
        base_hash=content_hash,
        message="Critique request submitted successfully",
    )


async def get_pitch_refine_status(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    current_user: Users,
) -> RefineStatusResponse:
    """
    Get the latest critique status and suggestions for a pitch.
    Computes is_stale dynamically by comparing pitch current hash with critique.current_hash.
    """
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if pitch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pitch not found")

    check_pitch_authorization(pitch, current_user)

    current_hash = compute_pitch_hash(pitch.title, pitch.description, pitch.content)

    # Find latest AIJob for this pitch
    jobs_stmt = (
        select(AIJob).where(AIJob.job_type == "pitch.refine").order_by(AIJob.created_at.desc())
    )
    all_jobs = (await db.execute(jobs_stmt)).scalars().all()
    latest_job = next(
        (j for j in all_jobs if (j.payload or {}).get("pitch_id") == str(pitch_id)),
        None,
    )

    if latest_job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No critique request found for this pitch",
        )

    if latest_job.status != "succeeded":
        return RefineStatusResponse(
            job_id=latest_job.id,
            status=latest_job.status,
            error_message=latest_job.error_message,
            summary=None,
            suggestions=[],
            critique_created_at=None,
            version_token=None,
            is_stale=False,
        )

    # Load PitchCritique with suggestions
    critique_stmt = (
        select(PitchCritique)
        .where(
            PitchCritique.pitch_id == pitch.id,
            PitchCritique.job_id == latest_job.id,
        )
        .options(selectinload(PitchCritique.suggestions))
        .order_by(PitchCritique.created_at.desc())
    )
    critique = (await db.execute(critique_stmt)).scalar_one_or_none()

    if critique is None:
        # Fallback query by pitch_id and base_hash
        base_hash = (latest_job.payload or {}).get("base_hash", "")
        critique_stmt = (
            select(PitchCritique)
            .where(
                PitchCritique.pitch_id == pitch.id,
                PitchCritique.base_hash == base_hash,
            )
            .options(selectinload(PitchCritique.suggestions))
            .order_by(PitchCritique.created_at.desc())
        )
        critique = (await db.execute(critique_stmt)).scalar_one_or_none()

    if critique is None:
        return RefineStatusResponse(
            job_id=latest_job.id,
            status="succeeded",
            error_message=None,
            summary=None,
            suggestions=[],
            critique_created_at=None,
            version_token=None,
            is_stale=False,
        )

    is_stale = current_hash != critique.current_hash

    summary = CritiqueSummary(
        executive_assessment=critique.summary,
        strengths=critique.strengths or [],
    )

    suggestions = [
        SuggestionItem(
            id=s.id,
            field=s.field,
            section_label=s.section_label,
            severity=s.severity,
            title=s.title,
            original_excerpt=s.original_excerpt,
            suggested_text=s.suggested_text,
            rationale=s.rationale,
            status=s.status,
            applied_at=s.applied_at,
        )
        for s in critique.suggestions
    ]

    return RefineStatusResponse(
        job_id=latest_job.id,
        status="succeeded",
        error_message=None,
        summary=summary,
        suggestions=suggestions,
        critique_created_at=critique.created_at,
        version_token=critique.current_hash,
        is_stale=is_stale,
    )


async def apply_pitch_suggestion(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    version_token: str,
    current_user: Users,
) -> ApplySuggestionResponse:
    """
    Atomically apply an AI suggestion to the pitch with version token guard.
    Optimization: To avoid holding a PostgreSQL row lock and connection during
    external network latency, ai.embed() is pre-computed BEFORE acquiring the row lock.
    Once acquired, the lock is held for <1ms to re-verify the version token and commit.
    """
    # 1. Read current pitch state (without lock)
    pitch_stmt = select(Pitch).where(Pitch.id == pitch_id)
    pitch = (await db.execute(pitch_stmt)).scalar_one_or_none()
    if pitch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pitch not found")

    # 2. Authorize user
    check_pitch_authorization(pitch, current_user)

    # 3. Check version token against current content hash
    current_hash = compute_pitch_hash(pitch.title, pitch.description, pitch.content)
    if version_token != current_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Conflict: Pitch has been modified since critique was generated "
                "(version token mismatch)"
            ),
        )

    # 4. Fetch suggestion
    sug_stmt = select(PitchSuggestion).where(
        PitchSuggestion.id == suggestion_id,
        PitchSuggestion.pitch_id == pitch_id,
    )
    sug = (await db.execute(sug_stmt)).scalar_one_or_none()
    if sug is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")

    # Idempotency check: if already applied, return current state
    if sug.status == "applied":
        return ApplySuggestionResponse(
            suggestion_id=sug.id,
            status="applied",
            new_version_token=current_hash,
            applied_field=sug.field,
            message="Suggestion is already applied",
        )

    # 5. Verify target field and exact excerpt match
    target_field = sug.field
    if target_field not in ("title", "description", "content"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target field: {target_field}",
        )

    current_field_val = getattr(pitch, target_field) or ""
    occurrences = current_field_val.count(sug.original_excerpt)
    if occurrences != 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Conflict: Original excerpt was expected to occur exactly once in {target_field}, "
                f"but found {occurrences} occurrence(s)"
            ),
        )

    # 6. Apply replacement to target field
    new_field_val = current_field_val.replace(sug.original_excerpt, sug.suggested_text, 1)

    # 7. Build full PitchCreate preserving untouched fields and category
    new_pitch_create = PitchCreate(
        title=new_field_val if target_field == "title" else str(pitch.title),
        description=(
            new_field_val
            if target_field == "description"
            else (str(pitch.description) if pitch.description else None)
        ),
        content=new_field_val if target_field == "content" else str(pitch.content),
        category=pitch.category,
    )

    # 8. Compute new expected hash
    new_hash = compute_pitch_hash(
        new_pitch_create.title,
        new_pitch_create.description,
        new_pitch_create.content,
    )

    # 9. PRE-COMPUTE EMBEDDING OUTSIDE ANY DATABASE LOCK:
    # This prevents holding PostgreSQL row locks and connections
    # during the AI API network round-trip.
    ai = get_ai_provider()
    embeddings = await ai.embed([new_pitch_create.content])
    precomputed_embedding = embeddings[0] if embeddings else None

    # 10. ATOMIC UPDATE PHASE (Row lock held for <1ms):
    # Lock pitch and re-verify version token to ensure no concurrent modification occurred
    # during the ai.embed() network call.
    pitch_locked = (
        await db.execute(select(Pitch).where(Pitch.id == pitch_id).with_for_update())
    ).scalar_one_or_none()
    if pitch_locked is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pitch not found")

    locked_current_hash = compute_pitch_hash(
        pitch_locked.title, pitch_locked.description, pitch_locked.content
    )
    if version_token != locked_current_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Conflict: Pitch was modified while processing the suggestion. "
                "Please refresh critique before applying."
            ),
        )

    sug_locked = (
        await db.execute(
            select(PitchSuggestion)
            .where(
                PitchSuggestion.id == suggestion_id,
                PitchSuggestion.pitch_id == pitch_id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if sug_locked is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")

    if sug_locked.status == "applied":
        return ApplySuggestionResponse(
            suggestion_id=sug_locked.id,
            status="applied",
            new_version_token=locked_current_hash,
            applied_field=sug_locked.field,
            message="Suggestion is already applied",
        )

    # Mark suggestion as applied
    sug_locked.status = "applied"
    sug_locked.applied_at = datetime.now(UTC)

    # Advance critique version token
    critique_stmt = (
        select(PitchCritique).where(PitchCritique.id == sug_locked.critique_id).with_for_update()
    )
    critique = (await db.execute(critique_stmt)).scalar_one_or_none()
    if critique is not None:
        critique.current_hash = new_hash
        critique.updated_at = datetime.now(UTC)

    await db.flush()

    # 11. Fast DB update using precomputed embedding
    await update_pitch(
        db=db,
        pitch_id=pitch_id,
        pitch=new_pitch_create,
        embedding=precomputed_embedding,
    )

    return ApplySuggestionResponse(
        suggestion_id=sug_locked.id,
        status="applied",
        new_version_token=new_hash,
        applied_field=target_field,
        message="Suggestion applied successfully",
    )


async def dismiss_pitch_suggestion(
    db: AsyncSession,
    pitch_id: uuid.UUID,
    suggestion_id: uuid.UUID,
    current_user: Users,
) -> DismissSuggestionResponse:
    """
    Dismiss a suggestion so it is hidden or marked ignored.
    """
    result = await db.execute(select(Pitch).where(Pitch.id == pitch_id))
    pitch = result.scalar_one_or_none()
    if pitch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pitch not found")

    check_pitch_authorization(pitch, current_user)

    sug_stmt = select(PitchSuggestion).where(
        PitchSuggestion.id == suggestion_id,
        PitchSuggestion.pitch_id == pitch_id,
    )
    sug = (await db.execute(sug_stmt)).scalar_one_or_none()
    if sug is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")

    sug.status = "dismissed"
    await db.commit()

    return DismissSuggestionResponse(suggestion_id=sug.id, status="dismissed")

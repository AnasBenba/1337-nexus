"""Canvas snapshot compaction engine (CV-402)."""

from app.collaboration.canvas.compact_document.service import (
    DEFAULT_COMPACTION_THRESHOLD,
    CompactionResult,
    compact_canvas_document,
    get_canvas_advisory_lock_key,
    maybe_compact_canvas_document,
    merge_updates_with_snapshot,
)

__all__ = [
    "DEFAULT_COMPACTION_THRESHOLD",
    "CompactionResult",
    "compact_canvas_document",
    "get_canvas_advisory_lock_key",
    "maybe_compact_canvas_document",
    "merge_updates_with_snapshot",
]

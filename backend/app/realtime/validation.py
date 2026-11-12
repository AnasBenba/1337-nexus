from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Default maximum realtime packet payload bound (256 KB)
DEFAULT_MAX_PAYLOAD_BYTES = 256 * 1024


def validate_payload_size(
    data: Any,
    max_bytes: int = DEFAULT_MAX_PAYLOAD_BYTES,
) -> bytes:
    """
    Validate that incoming realtime data is binary and strictly bounded within max_bytes.
    Prevents memory exhaustion and packet bloat on WebSocket relays.
    """
    if not isinstance(data, (bytes, bytearray)):
        msg = f"Expected binary payload (bytes/bytearray), got {type(data).__name__}"
        raise ValueError(msg)

    raw_bytes = bytes(data)
    if len(raw_bytes) > max_bytes:
        msg = f"Payload size {len(raw_bytes)} bytes exceeds limit {max_bytes} bytes"
        raise ValueError(msg)

    return raw_bytes

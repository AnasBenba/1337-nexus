"""Avatar validation, WebP normalization, and safe local/shared storage helpers."""

from __future__ import annotations

import io
import os
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


def resolve_media_root() -> Path:
    """Resolve a writable media root, preferring MEDIA_ROOT or Docker's /media."""
    configured = os.getenv("MEDIA_ROOT")
    if configured:
        return Path(configured)

    docker_media = Path("/media")
    if docker_media.exists() and os.access(docker_media, os.W_OK):
        return docker_media

    return Path(__file__).resolve().parents[3] / "media"


MEDIA_ROOT = resolve_media_root()
AVATAR_DIR = MEDIA_ROOT / "avatars"
AVATAR_URL_PREFIX = "/media/avatars/"

MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_AVATAR_PIXELS = 25_000_000
AVATAR_SIZE = 256
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP"}


class InvalidAvatarError(ValueError):
    """Raised when uploaded bytes are not a supported or safe image."""


def delete_avatar_file(url: str | None) -> None:
    """Remove an uploaded local avatar from disk (no-op for None or external URLs)."""
    if url and url.startswith(AVATAR_URL_PREFIX):
        (AVATAR_DIR / Path(url).name).unlink(missing_ok=True)


def process_avatar(data: bytes) -> bytes:
    """Validate an uploaded image and re-encode it as a square 256x256 WebP."""
    try:
        image = Image.open(io.BytesIO(data))
        if image.format not in ALLOWED_FORMATS:
            raise InvalidAvatarError("Only PNG, JPEG or WebP images are allowed.")
        if image.width * image.height > MAX_AVATAR_PIXELS:
            raise InvalidAvatarError("Image dimensions are too large.")
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidAvatarError("File is not a valid image.") from exc

    transposed = ImageOps.exif_transpose(image)
    fitted = ImageOps.fit(transposed.convert("RGBA"), (AVATAR_SIZE, AVATAR_SIZE))

    out = io.BytesIO()
    fitted.save(out, "WEBP", quality=85)
    return out.getvalue()


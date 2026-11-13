import io
import os
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

# Shared volume: the backend writes here, nginx serves it at /media/.
AVATAR_DIR = Path(os.getenv("MEDIA_ROOT", "/media")) / "avatars"
AVATAR_URL_PREFIX = "/media/avatars/"

MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_AVATAR_PIXELS = 25_000_000  # reject huge dimensions before decoding (decompression bombs)
AVATAR_SIZE = 256
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP"}


class InvalidAvatarError(ValueError):
    pass


def delete_avatar_file(url: str | None) -> None:
    """Remove an uploaded avatar from disk (no-op for None or foreign URLs)."""
    if url and url.startswith(AVATAR_URL_PREFIX):
        # Path(...).name drops any directory part, so this can only touch AVATAR_DIR.
        (AVATAR_DIR / Path(url).name).unlink(missing_ok=True)


def process_avatar(data: bytes) -> bytes:
    """Validate an uploaded image and re-encode it as a square 256x256 WebP.

    We never trust the browser's Content-Type: Pillow reads the real format from the bytes.
    Re-encoding also strips metadata (EXIF/GPS) and anything hidden after the image data.
    """
    try:
        image = Image.open(io.BytesIO(data))
        if image.format not in ALLOWED_FORMATS:
            raise InvalidAvatarError("Only PNG, JPEG or WebP images are allowed.")
        if image.width * image.height > MAX_AVATAR_PIXELS:
            raise InvalidAvatarError("Image dimensions are too large.")
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidAvatarError("File is not a valid image.") from exc

    image = ImageOps.exif_transpose(image)  # respect phone-camera rotation
    image = ImageOps.fit(image.convert("RGBA"), (AVATAR_SIZE, AVATAR_SIZE))  # center-crop square

    out = io.BytesIO()
    image.save(out, "WEBP", quality=85)
    return out.getvalue()

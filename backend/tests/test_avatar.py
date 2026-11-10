import io

import pytest
from PIL import Image

from app.user.profile.avatar import AVATAR_SIZE, InvalidAvatarError, process_avatar


def _image_bytes(fmt: str, size: tuple[int, int] = (400, 300)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, "red").save(buf, fmt)
    return buf.getvalue()


@pytest.mark.parametrize("fmt", ["PNG", "JPEG", "WEBP"])
def test_valid_image_becomes_square_webp(fmt: str) -> None:
    out = Image.open(io.BytesIO(process_avatar(_image_bytes(fmt))))
    assert out.format == "WEBP"
    assert out.size == (AVATAR_SIZE, AVATAR_SIZE)


@pytest.mark.parametrize(
    "data",
    [
        b"not an image at all",
        b"<?php echo 'hi'; ?>",
        _image_bytes("GIF"),  # real image, but not an allowed format
        _image_bytes("PNG")[:50],  # truncated file
    ],
)
def test_invalid_files_are_rejected(data: bytes) -> None:
    with pytest.raises(InvalidAvatarError):
        process_avatar(data)

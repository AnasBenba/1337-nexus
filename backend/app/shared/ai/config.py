import contextlib
import os
from pathlib import Path


def _load_env_fallback() -> None:
    """Load key-value pairs from .env if not already set in os.environ."""
    candidates = [
        Path(".env"),
        Path("backend/.env"),
        Path("deploy/.env"),
        Path(__file__).resolve().parents[4] / "deploy" / ".env",
        Path(__file__).resolve().parents[3] / ".env",
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            with contextlib.suppress(OSError):
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k not in os.environ:
                            os.environ[k] = v


_load_env_fallback()

EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
EMBEDDING_DIMENSIONS: int = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))


def get_api_key() -> str | None:
    """Resolve API key: GEMINI_API_KEY -> GOOGLE_API_KEY."""
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
GOOGLE_API_KEY: str | None = os.getenv("GOOGLE_API_KEY")

AI_API_KEY: str | None = get_api_key()

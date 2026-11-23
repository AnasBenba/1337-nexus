import contextlib
import os
from pathlib import Path


def _load_env_fallback() -> None:
    """Load key-value pairs from .env if not already set in os.environ."""
    candidates = [
        Path("deploy/.env"),
        Path(__file__).resolve().parents[4] / "deploy" / ".env",
        Path(".env"),
        Path("backend/.env"),
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


def get_api_keys() -> list[str]:
    """Resolve all configured API keys in priority order: GEMINI_API_KEY -> GEMINI_API_KEY1 -> GOOGLE_API_KEY."""
    keys: list[str] = []
    for env_name in ("GEMINI_API_KEY", "GEMINI_API_KEY1", "GOOGLE_API_KEY"):
        val = os.getenv(env_name)
        if val and val.strip() and val.strip() not in keys:
            keys.append(val.strip())
    return keys


def get_api_key() -> str | None:
    """Resolve primary API key: GEMINI_API_KEY -> GEMINI_API_KEY1 -> GOOGLE_API_KEY."""
    keys = get_api_keys()
    return keys[0] if keys else None


GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
GEMINI_API_KEY1: str | None = os.getenv("GEMINI_API_KEY1")
GOOGLE_API_KEY: str | None = os.getenv("GOOGLE_API_KEY")

AI_API_KEY: str | None = get_api_key()

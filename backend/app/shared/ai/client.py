import os

from .gemini import GeminiAIProvider
from .provider import AIProvider
from .stub import stub


def get_ai_provider() -> AIProvider:
    mode = os.getenv("AI_PROVIDER", "stub").lower()
    if mode in ("remote", "gemini", "google"):
        return GeminiAIProvider()
    elif mode == "stub":
        return stub()
    raise ValueError(f"Unknown AI_PROVIDER mode: {mode}")

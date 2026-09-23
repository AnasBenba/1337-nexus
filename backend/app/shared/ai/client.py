from .provider import AIProvider
from .stub import stub
import os

def	get_ai_provider() -> AIProvider:
	mode = os.getenv("AI_PROVIDER", "stub")
	if mode == "stub":
		return stub()
	elif mode == "remote":
		raise NotImplementedError("Remote provider is not implemented yet.")

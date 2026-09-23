import asyncio
import re
import hashlib
import random
import os
from typing import Protocol

class AIProvider(Protocol):
	async def stream_complete(self, messages: list[dict]) -> asyncio.AsyncGenerator[str, None]:
		...
	async def embed(self, texts: list[str]) -> list[list[float]]:
		...


class stub(AIProvider):
	def __init__(self):
		self.response = "This is a stub response."
 
	async def stream_complete(self, messages: list[dict]):
		for chunk in re.split(r'(\s+)', self.response):
			yield chunk
			await asyncio.sleep(0.05)

	async def embed(self, texts: list[str]) -> list[list[float]]:
		embeddings = []
		for text in texts:
			digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
			seed = int(digest[:16], 16)
			random.seed(seed)
			vector = [random.uniform(-1, 1) for _ in range(1536)]
			embeddings.append(vector)
		return embeddings

def	get_ai_provider() -> AIProvider:
	mode = os.getenv("AI_PROVIDER", "stub")
	if mode == "stub":
		return stub()
	elif mode == "remote":
		raise NotImplementedError("Remote provider is not implemented yet.")

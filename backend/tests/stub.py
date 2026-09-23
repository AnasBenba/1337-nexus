import asyncio
import re
import hashlib
import random
from typing import Protocol

class AIProtocol(Protocol):
	async def stream_complete(self, messages: list[dict]) -> asyncio.AsyncGenerator[str, None]:
		...
	async def embed(self, texts: list[str]) -> list[list[float]]:
		...



class stub(AIProtocol):
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

stub_instance = stub()
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain memory allocation."}
]

async def main():
	async for chunk in stub_instance.stream_complete(messages):
		print(chunk, end="", flush=True)

asyncio.run(main())
import httpx
import os

async def get_access_token(code: str, code_verifier: str) -> dict:
    client_id = os.getenv("UID")
    client_secret = os.getenv("SECRET")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.intra.42.fr/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": "http://localhost:8000/api/v1/auth/oauth/42/callback",
                "code_verifier": code_verifier
            }
        )
        return response.json()
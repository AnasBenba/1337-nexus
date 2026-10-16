import httpx
import os
from ..core import db
from sqlalchemy import inspect 
import httpx

async def get_user(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.intra.42.fr/v2/me",
            headers={
                "Authorization": f"Bearer {access_token}"
            }
        )
        return response.json()


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
    

async def manage_user(token : dict) ->None :
    async with db.engine.connect() as connection :
        exist = await connection.run_sync(
            lambda conn : inspect(conn).has_table("users")
        )
        if not exist :
            
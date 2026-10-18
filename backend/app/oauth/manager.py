import httpx
import os
from ..core import db
from sqlalchemy import inspect 
import httpx
from ..core import base
from . import user

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
    redirect_url = os.getenv("REDIRECT_URL")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.intra.42.fr/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_url,
                "code_verifier": code_verifier
            }
        )
        return response.json()
    

async def manage_user(token: dict) -> None:
    async with db.migration_engine.begin() as connection:
        await connection.run_sync(base.Base.metadata.create_all)
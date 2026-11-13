import os

import httpx
from fastapi import HTTPException
from sqlalchemy import select

from ..core import base, db
from . import user
from .permissions import Role


async def get_user(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.intra.42.fr/v2/me", headers={"Authorization": f"Bearer {access_token}"}
        )
        return response.json()


async def get_access_token(code: str, code_verifier: str) -> dict:
    client_id = os.getenv("UID")
    client_secret = os.getenv("SECRET")
    redirect_url = os.getenv("REDIRECT_URL")

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.intra.42.fr/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_url,
                "code_verifier": code_verifier,
            },
        )

        if response.status_code != 200:
            print("Token exchange failed:", response.status_code, response.json())
            raise HTTPException(
                status_code=502,
                detail="Failed to authenticate with 42 Intra",
            )

        token = response.json()

        if "access_token" not in token:
            raise HTTPException(
                status_code=502,
                detail="42 Intra returned an invalid token response",
            )

        return token


# async def manage_user(user_data: dict) -> None:
#     async with db.migration_engine.begin() as connection:
#         await connection.run_sync(base.Base.metadata.create_all)
#     async with db.SessionLocal() as session:
#         result = await session.execute(
#             select(user.Users).where(user.Users.login == user_data["login"])
#         )
#         existing = result.scalar_one_or_none()

#         if existing is None:
#             session.add(
#                 user.Users(
#                     login=user_data["login"],
#                     fullname=user_data["displayname"],
#                     role="user",
#                     intra_id=user_data["id"]
#                 )
#             )
#             await session.commit()


async def manage_user(user_data: dict) -> user.Users:
    async with db.migration_engine.begin() as connection:
        await connection.run_sync(base.Base.metadata.create_all)

    intra_id, intra_login = user_data["id"], user_data["login"]

    async with db.SessionLocal() as session:
        # Match 42 accounts by their 42 id, never by username: since email sign-up lets
        # anyone pick a username, matching by login would let someone pre-register
        # "ofrikel" and get the real ofrikel's 42 account attached to it.
        existing = await session.scalar(select(user.Users).where(user.Users.intra_id == intra_id))
        if existing is not None:
            return existing

        async def taken(column, value) -> bool:  # noqa: ANN001
            return value is not None and await session.scalar(select(user.Users.id).where(column == value)) is not None

        # New 42 account. If an email account already uses this username, add a suffix.
        login = intra_login
        if await taken(user.Users.login, login):
            login = f"{intra_login}-42"
            if await taken(user.Users.login, login):
                login = f"{intra_login}-42-{intra_id}"

        # Keep the 42 email so nobody can later sign up with it, unless it's already used.
        email = (user_data.get("email") or "").lower() or None
        if await taken(user.Users.email, email):
            email = None

        new_user = user.Users(
            login=login,
            fullname=user_data["displayname"],
            role=Role.USER,  # admins are made by the superadmin, never automatically
            intra_id=intra_id,
            email=email,
        )

        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

        return new_user

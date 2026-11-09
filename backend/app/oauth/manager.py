from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select

from ..core import base, db
from . import user


async def get_user(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.intra.42.fr/v2/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        return response.json()  # type: ignore[no-any-return]


async def get_access_token(code: str, code_verifier: str) -> dict[str, Any]:
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
            raise HTTPException(
                status_code=502,
                detail="Failed to authenticate with 42 Intra",
            )

        token: dict[str, Any] = response.json()

        if "access_token" not in token:
            raise HTTPException(
                status_code=502,
                detail="42 Intra returned an invalid token response",
            )

        return token


async def manage_user(user_data: dict[str, Any]) -> user.Users:
    async with db.migration_engine.begin() as connection:
        await connection.run_sync(base.Base.metadata.create_all)

    async with db.SessionLocal() as session:
        result = await session.execute(
            select(user.Users).where(user.Users.login == user_data["login"])
        )
        existing = result.scalar_one_or_none()

        if existing is not None:
            return existing

        image_data = user_data.get("image") or {}
        avatar = image_data.get("link") if isinstance(image_data, dict) else None

        new_user = user.Users(
            login=user_data["login"],
            fullname=user_data.get("displayname") or user_data["login"],
            role="user",
            intra_id=user_data.get("id"),
            email=user_data.get("email"),
            avatar_url=avatar,
        )

        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

        return new_user

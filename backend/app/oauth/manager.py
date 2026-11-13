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


def _extract_intra_avatar(user_data: dict[str, Any]) -> str | None:
    """Extract the profile photo URL from 42 Intra /v2/me payload if present."""
    image_data = user_data.get("image")
    if not isinstance(image_data, dict):
        return None
    link = image_data.get("link")
    if isinstance(link, str) and link.strip():
        return link.strip()
    versions = image_data.get("versions")
    if isinstance(versions, dict):
        for size_key in ("medium", "small", "large", "micro"):
            candidate = versions.get(size_key)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
    return None


async def manage_user(user_data: dict[str, Any]) -> user.Users:
    async with db.migration_engine.begin() as connection:
        await connection.run_sync(base.Base.metadata.create_all)

    intra_id = user_data.get("id")
    intra_login = str(user_data["login"])
    avatar = _extract_intra_avatar(user_data)

    async with db.SessionLocal() as session:
        # Match 42 accounts strictly by intra_id so email registration cannot hijack a login.
        existing: user.Users | None = None
        if intra_id is not None:
            existing = await session.scalar(
                select(user.Users).where(user.Users.intra_id == intra_id)
            )

        if existing is not None:
            # Keep custom uploaded /media/ avatars, otherwise sync the latest 42 Intra photo.
            if avatar and (
                not existing.avatar_url or not existing.avatar_url.startswith("/media/")
            ):
                existing.avatar_url = avatar
                await session.commit()
                await session.refresh(existing)
            return existing

        async def _taken(column: Any, value: Any) -> bool:
            if value is None:
                return False
            return (await session.scalar(select(user.Users.id).where(column == value))) is not None

        login = intra_login
        if await _taken(user.Users.login, login):
            login = f"{intra_login}-42"
            if await _taken(user.Users.login, login):
                login = f"{intra_login}-42-{intra_id}"

        raw_email = user_data.get("email")
        email = str(raw_email).strip().lower() if raw_email else None
        if await _taken(user.Users.email, email):
            email = None

        new_user = user.Users(
            login=login,
            fullname=user_data.get("displayname") or intra_login,
            role="user",
            intra_id=intra_id,
            email=email,
            avatar_url=avatar,
        )

        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)

        return new_user

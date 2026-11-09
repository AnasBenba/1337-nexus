from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import HTTPException, status

JWT_SECRET = os.getenv("JWT_SECRET", "nexus_default_jwt_secret_key_32_characters_long_min")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def create_access_token(
    user_id: uuid.UUID | str | int | None = None,
    role: str = "user",
    intra_id: int | None = None,
) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")

    sub = str(user_id if user_id is not None else intra_id)
    expiration_time = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": sub,
        "role": role,
        "exp": expiration_time,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def verify_access_token(token: str) -> dict[str, Any]:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")

    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        if "sub" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

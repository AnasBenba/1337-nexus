import os
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException, status

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15


# Tokens identify the app's own user id (users.id), so 42 and email/password accounts
# work the same way. Old tokens (sub = bare 42 intra id) don't match and get a 401,
# which the frontend answers with a silent refresh.
SUBJECT_PREFIX = "user:"


def create_access_token(user_id: int) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")

    expiration_time = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": f"{SUBJECT_PREFIX}{user_id}",
        "exp": expiration_time,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def verify_access_token(token: str) -> dict:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured")

    try:
        payload = jwt.decode(
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


def user_id_from(payload: dict) -> int:
    """users.id from a verified token payload, or 401 if the subject isn't ours."""
    sub = str(payload.get("sub", ""))
    raw_id = sub.removeprefix(SUBJECT_PREFIX)
    if not sub.startswith(SUBJECT_PREFIX) or not raw_id.isdigit():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return int(raw_id)

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth import jwt
from app.oauth.user import Users


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> Users:
    token = None
    # 1. Try Authorization header first (tab-scoped bearer token)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()

    # 2. Fallback to cookie
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = jwt.verify_access_token(token)
    sub = payload.get("sub")
    user_id_claim = payload.get("user_id")

    user: Users | None = None

    # Try UUID lookup first if user_id or sub is a valid UUID
    for candidate in [user_id_claim, sub]:
        if candidate:
            try:
                candidate_uuid = UUID(str(candidate))
                user = await db.scalar(select(Users).where(Users.id == candidate_uuid))
                if user is not None:
                    break
            except (ValueError, TypeError):
                pass

    # Fallback to intra_id lookup if sub is integer
    if user is None and sub is not None:
        try:
            intra_id = int(sub)
            user = await db.scalar(select(Users).where(Users.intra_id == intra_id))
        except (ValueError, TypeError):
            pass

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user was not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

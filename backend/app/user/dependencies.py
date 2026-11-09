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
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = jwt.verify_access_token(token)
    try:
        intra_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    user = await db.scalar(select(Users).where(Users.intra_id == intra_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user was not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

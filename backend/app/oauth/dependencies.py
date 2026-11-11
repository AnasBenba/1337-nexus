from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth import jwt
from app.oauth.user import Users


async def get_current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Users:
    """Resolve the signed-in user from the access_token cookie, or 401."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = jwt.user_id_from(jwt.verify_access_token(token))
    user = await session.get(Users, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


CurrentUser = Annotated[Users, Depends(get_current_user)]

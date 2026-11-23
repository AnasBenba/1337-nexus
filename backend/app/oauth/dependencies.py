from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth import jwt
from app.oauth.user import Users, get_user_by_intra_id


async def get_current_user(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Users:
    """Resolve the signed-in user from the access_token cookie, or 401."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = jwt.verify_access_token(token)
    user = None
    try:
        user_id = jwt.user_id_from(payload)
        user = await session.get(Users, user_id)
    except HTTPException:
        # Support legacy tokens where sub is intra_id integer
        try:
            intra_id = int(payload["sub"])
            user = await get_user_by_intra_id(session, intra_id)
        except (KeyError, TypeError, ValueError):
            pass

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_authenticated_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> Users:
    return await get_current_user(request=request, session=db)


CurrentUser = Annotated[Users, Depends(get_current_user)]

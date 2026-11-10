from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, hash_password, verify_password
from app.core.db import get_db_session
from app.oauth import jwt
from app.oauth.user import Users

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class UserRegisterRequest(BaseModel):
    login: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="Valid student or campus email")
    fullname: str = Field(..., min_length=2, max_length=150, description="Full name")
    password: str = Field(..., min_length=6, max_length=128, description="Secure password")


class UserLoginRequest(BaseModel):
    login_or_email: str = Field(..., description="Login username or registered email")
    password: str = Field(..., description="Account password")


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login: str
    email: str | None = None
    fullname: str
    role: str
    avatar_url: str | None = None
    intra_id: int | None = None


class AuthSuccessResponse(BaseModel):
    user: UserProfileResponse
    access_token: str
    token_type: str = "bearer"  # noqa: S105


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/register",
    response_model=AuthSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user with email and password",
)
async def register(
    data: UserRegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthSuccessResponse:
    """Create a new user account with salted Argon2 password hashing."""
    # 1. Check existing login or email
    stmt = select(Users).where((Users.login == data.login) | (Users.email == data.email))
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing is not None:
        if existing.login == data.login:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this login already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    # 2. Hash password with Argon2 and persist
    new_user = Users(
        id=uuid.uuid4(),
        login=data.login,
        email=data.email,
        fullname=data.fullname,
        role="user",
        password_hash=hash_password(data.password),
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 3. Issue JWT and set cookie
    token = jwt.create_access_token(new_user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=False,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )

    return AuthSuccessResponse(
        user=UserProfileResponse.model_validate(new_user),
        access_token=token,
    )


@router.post(
    "/login",
    response_model=AuthSuccessResponse,
    summary="Log in with email or username and password",
)
async def login(
    data: UserLoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthSuccessResponse:
    """Authenticate with email/login and password."""
    stmt = select(Users).where(
        (Users.login == data.login_or_email) | (Users.email == data.login_or_email)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive.",
        )

    token = jwt.create_access_token(user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=False,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )

    return AuthSuccessResponse(
        user=UserProfileResponse.model_validate(user),
        access_token=token,
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: Annotated[Users, Depends(get_current_user)],
) -> UserProfileResponse:
    """Return profile information of currently authenticated user."""
    return UserProfileResponse.model_validate(current_user)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Log out and clear session cookie",
)
async def logout(response: Response) -> dict[str, str]:
    """Clear session cookie and invalidate client state."""
    response.delete_cookie("access_token", path="/")
    return {"message": "Successfully logged out."}

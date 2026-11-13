from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user_strict,
    get_optional_user,
    hash_password,
    verify_password,
)
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
    login_or_email: str | None = Field(
        default=None, description="Login username or registered email"
    )
    email: str | None = Field(
        default=None, description="Email or username (Soufiane Login.tsx compatibility)"
    )
    password: str = Field(..., description="Account password")

    @model_validator(mode="after")
    def ensure_identifier(self) -> UserLoginRequest:
        identifier = (self.login_or_email or self.email or "").strip()
        if not identifier:
            raise ValueError("Either 'email' or 'login_or_email' must be provided.")
        self.login_or_email = identifier
        return self


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
    # Top-level fields for Soufiane's Auth.api.ts (Me) compatibility:
    id: uuid.UUID | None = None
    login: str | None = None
    fullname: str | None = None
    role: str | None = None


class SessionStatusResponse(BaseModel):
    signed_in: bool
    user: UserProfileResponse | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


async def _register_user(
    data: UserRegisterRequest,
    response: Response,
    db: AsyncSession,
) -> AuthSuccessResponse:
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

    token = jwt.create_access_token(new_user.id, role=new_user.role)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24,
        path="/",
    )

    profile = UserProfileResponse.model_validate(new_user)
    return AuthSuccessResponse(
        user=profile,
        access_token=token,
        id=profile.id,
        login=profile.login,
        fullname=profile.fullname,
        role=profile.role,
    )


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
    return await _register_user(data, response, db)


@router.post(
    "/signup",
    response_model=AuthSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sign up a new user (alias for /register)",
)
async def signup(
    data: UserRegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthSuccessResponse:
    return await _register_user(data, response, db)


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
    identifier = data.login_or_email or ""
    stmt = select(Users).where((Users.login == identifier) | (Users.email == identifier))
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

    token = jwt.create_access_token(user.id, role=user.role)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24,
        path="/",
    )

    profile = UserProfileResponse.model_validate(user)
    return AuthSuccessResponse(
        user=profile,
        access_token=token,
        id=profile.id,
        login=profile.login,
        fullname=profile.fullname,
        role=profile.role,
    )


@router.get(
    "/session",
    response_model=SessionStatusResponse,
    summary="Check whether the current session is signed in (never returns 401)",
)
async def check_session(
    current_user: Annotated[Users | None, Depends(get_optional_user)],
) -> SessionStatusResponse:
    if current_user is None:
        return SessionStatusResponse(signed_in=False, user=None)
    return SessionStatusResponse(
        signed_in=True,
        user=UserProfileResponse.model_validate(current_user),
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: Annotated[Users, Depends(get_current_user_strict)],
) -> Any:
    return UserProfileResponse.model_validate(current_user)


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Log out and clear session cookie",
)
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie("access_token", path="/")
    return {"message": "Successfully logged out."}

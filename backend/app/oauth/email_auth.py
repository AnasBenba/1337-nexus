"""Email + password sign-up and login (mandatory part of the subject).

Both set the same cookies as 42 login (access + refresh token), so the rest of the
app doesn't care how you signed in.
"""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db_session
from app.oauth import refresh_tokens
from app.oauth.passwords import hash_password, verify_password
from app.oauth.permissions import Role
from app.oauth.user import Users
from app.user.profile.schemas import MyProfile

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

DbSession = Annotated[AsyncSession, Depends(get_db_session)]

LOGIN_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{2,19}$")
RESERVED_LOGINS = {"me", "admin", "api", "login", "signup", "friends", "users"}
PASSWORD_MIN, PASSWORD_MAX = 8, 128  # the max stops huge inputs from tying up the hasher


class SignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    login: str = Field(description="Username: 3-20 chars, lowercase letters, digits, '-' or '_'")
    fullname: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("login")
    @classmethod
    def check_login(cls, v: str) -> str:
        v = v.strip().lower()
        if not LOGIN_RE.fullmatch(v):
            raise ValueError("3-20 characters: lowercase letters, digits, '-' or '_', starting with a letter or digit.")
        if v in RESERVED_LOGINS:
            raise ValueError("This username is reserved.")
        return v

    @field_validator("fullname")
    @classmethod
    def strip_fullname(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        return v

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if v.strip() == "":
            raise ValueError("Password can't be only spaces.")
        return v


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()


async def _start_session(session: AsyncSession, response: Response, user: Users) -> None:
    token = await refresh_tokens.issue(session, user.id)
    await session.commit()
    refresh_tokens.set_auth_cookies(response, user, token)


@router.post("/signup", response_model=MyProfile, status_code=status.HTTP_201_CREATED, summary="Create an account")
async def signup(body: SignupRequest, response: Response, session: DbSession) -> Users:
    if await session.scalar(select(func.count()).where(Users.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    if await session.scalar(select(func.count()).where(Users.login == body.login)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This username is taken.")

    user = Users(
        email=body.email,
        login=body.login,
        fullname=body.fullname,
        role=Role.USER,  # never taken from the request: sign-up can't make you admin
        password_hash=hash_password(body.password),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:  # someone took the email/username a moment ago
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already taken.") from exc

    await _start_session(session, response, user)
    return user


@router.post("/login", response_model=MyProfile, summary="Log in with email and password")
async def login(body: LoginRequest, response: Response, session: DbSession) -> Users:
    user = await session.scalar(select(Users).where(Users.email == body.email))
    valid, new_hash = verify_password(body.password, user.password_hash if user else None)
    if user is None or not valid:
        # Same message for "no such email" and "wrong password": don't reveal which emails exist.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password.")
    if new_hash:
        user.password_hash = new_hash  # hashing parameters were raised since this hash was made
    await _start_session(session, response, user)
    return user

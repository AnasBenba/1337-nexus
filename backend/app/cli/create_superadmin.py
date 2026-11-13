"""Make sure the superadmin account exists (run on every container start).

The superadmin is the only account that can make or remove admins, and nobody can
edit, delete or re-role it through the API (see app/oauth/permissions.py). This
script is the only way to create one.

Configured in deploy/.env:
    SUPERADMIN_EMAIL=owner@example.com
    SUPERADMIN_PASSWORD=<at least 8 characters>
    SUPERADMIN_LOGIN=superadmin        (optional)
    SUPERADMIN_NAME=Super Admin        (optional)

Safe to run again and again:
- SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set -> does nothing
- no account with that email  -> creates it (role superadmin, Argon2-hashed password)
- account already exists      -> makes sure it's superadmin; never changes its password

Run by hand:  python -m app.cli.create_superadmin   (or: make seed)
"""

import asyncio
import os
import sys

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.oauth.email_auth import SignupRequest
from app.oauth.passwords import hash_password
from app.oauth.permissions import Role
from app.oauth.user import Users

DEFAULT_LOGIN = "superadmin"
DEFAULT_NAME = "Super Admin"


class SuperadminSetupError(Exception):
    pass


async def ensure_superadmin(session: AsyncSession, data: SignupRequest) -> str:
    """Create or promote the superadmin. Returns what happened: created, promoted or unchanged."""
    user = await session.scalar(select(Users).where(Users.email == data.email))
    if user is not None:
        if user.role == Role.SUPERADMIN:
            return "unchanged"
        user.role = Role.SUPERADMIN
        await session.commit()
        return "promoted"

    owner = await session.scalar(select(Users).where(Users.login == data.login))
    if owner is not None:
        raise SuperadminSetupError(
            f"username '{data.login}' is already used by another account; set SUPERADMIN_LOGIN to a free one."
        )

    session.add(
        Users(
            email=data.email,
            login=data.login,
            fullname=data.fullname,
            role=Role.SUPERADMIN,
            password_hash=hash_password(data.password),
        )
    )
    await session.commit()
    return "created"


def config_from_env() -> SignupRequest | None:
    email, password = os.getenv("SUPERADMIN_EMAIL", "").strip(), os.getenv("SUPERADMIN_PASSWORD", "")
    if not email and not password:
        return None
    if not email or not password:
        raise SuperadminSetupError("set both SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (or neither).")
    try:
        # Same rules as public sign-up (valid email, username format, password length).
        return SignupRequest(
            email=email,
            password=password,
            login=os.getenv("SUPERADMIN_LOGIN", DEFAULT_LOGIN),
            fullname=os.getenv("SUPERADMIN_NAME", DEFAULT_NAME),
        )
    except ValidationError as exc:
        problems = "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors())
        raise SuperadminSetupError(problems) from exc


async def main() -> int:
    try:
        data = config_from_env()
        if data is None:
            print("create_superadmin: SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD not set, skipping.")
            return 0
        async with SessionLocal() as session:
            result = await ensure_superadmin(session, data)
    except SuperadminSetupError as exc:
        print(f"create_superadmin: ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"create_superadmin: {data.email} {result}.")  # never print the password
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

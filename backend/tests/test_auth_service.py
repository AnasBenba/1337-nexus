from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.auth import hash_password, verify_password
from app.core.db import engine
from app.main import app


@pytest.fixture(autouse=True)
async def dispose_engine_connections() -> None:
    await engine.dispose()
    yield
    await engine.dispose()


def test_argon2_password_hashing() -> None:
    """Test password hashing and verification using Argon2."""
    plain = "SuperSecurePassword123!"
    hashed = hash_password(plain)

    assert hashed != plain
    assert "$argon2" in hashed
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


@pytest.mark.asyncio
async def test_auth_register_and_login_flow() -> None:
    """Test full registration, login, and me endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_login = f"user_{uuid.uuid4().hex[:8]}"
        unique_email = f"{unique_login}@1337.ma"

        # 1. Register new user
        reg_payload = {
            "login": unique_login,
            "email": unique_email,
            "fullname": "Test User",
            "password": "Password123!",
        }
        res = await client.post("/api/v1/auth/register", json=reg_payload)
        assert res.status_code == 201
        data = res.json()
        assert data["user"]["login"] == unique_login
        assert data["user"]["email"] == unique_email
        assert "access_token" in data
        assert "access_token" in res.cookies

        # 2. Duplicate registration returns 409
        dup_res = await client.post("/api/v1/auth/register", json=reg_payload)
        assert dup_res.status_code == 409

        # 3. Log in with registered credentials
        login_payload = {
            "login_or_email": unique_email,
            "password": "Password123!",
        }
        login_res = await client.post("/api/v1/auth/login", json=login_payload)
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        assert token

        # 4. Access /me with token
        me_res = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["login"] == unique_login

        # 5. Logout clears cookie
        logout_res = await client.post("/api/v1/auth/logout")
        assert logout_res.status_code == 200

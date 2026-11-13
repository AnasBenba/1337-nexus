from __future__ import annotations

import os
from unittest.mock import patch

import jwt
import pytest
from fastapi import HTTPException

# Ensure JWT_SECRET is set for tests
os.environ.setdefault("JWT_SECRET", "test_super_secret_jwt_key_1234567890")

from app.oauth.jwt import JWT_ALGORITHM, create_access_token, verify_access_token
from app.oauth.user import Users


def test_jwt_create_and_verify_success() -> None:
    """Test valid token generation and decoding."""
    with patch("app.oauth.jwt.JWT_SECRET", "test_secret_key_fixed_length"):
        token = create_access_token(intra_id=4242)
        assert isinstance(token, str)

        payload = verify_access_token(token)
        assert payload["sub"] == "4242"
        assert "exp" in payload


def test_jwt_missing_secret_raises_runtime_error() -> None:
    """Test RuntimeError when JWT_SECRET is not configured."""
    with patch("app.oauth.jwt.JWT_SECRET", None):
        with pytest.raises(RuntimeError, match="JWT_SECRET is not configured"):
            create_access_token(1234)

        with pytest.raises(RuntimeError, match="JWT_SECRET is not configured"):
            verify_access_token("some.token.value")


def test_jwt_expired_token_raises_401() -> None:
    """Test ExpiredSignatureError maps to 401 HTTPException."""
    import time

    secret = "test_secret_for_expiry"  # noqa: S105
    with patch("app.oauth.jwt.JWT_SECRET", secret):
        expired_payload = {
            "sub": "9999",
            "exp": int(time.time()) - 100,  # 100 seconds in the past
        }
        expired_token = jwt.encode(expired_payload, secret, algorithm=JWT_ALGORITHM)

        with pytest.raises(HTTPException) as exc_info:
            verify_access_token(expired_token)
        assert exc_info.value.status_code == 401
        assert "expired" in exc_info.value.detail.lower()


def test_jwt_invalid_token_signature_raises_401() -> None:
    """Test token signed with wrong key raises 401."""
    with patch("app.oauth.jwt.JWT_SECRET", "correct_key"):
        wrong_token = jwt.encode({"sub": "1234"}, "wrong_key", algorithm=JWT_ALGORITHM)
        with pytest.raises(HTTPException) as exc_info:
            verify_access_token(wrong_token)
        assert exc_info.value.status_code == 401
        assert "invalid" in exc_info.value.detail.lower()


def test_users_model_instantiation() -> None:
    """Test Soufiane's Users model fields."""
    import uuid

    user_id = uuid.uuid4()
    user = Users(
        id=user_id,
        login="soufiane",
        fullname="Soufiane El B",
        role="student",
        intra_id=424242,
    )
    assert user.id == user_id
    assert user.login == "soufiane"
    assert user.fullname == "Soufiane El B"
    assert user.role == "student"
    assert user.intra_id == 424242


@pytest.mark.asyncio
async def test_backend_root_and_oauth_routes_never_return_html() -> None:
    """Requesting /, /home, and OAuth entry routes without a session never returns text/html."""
    from httpx import ASGITransport, AsyncClient

    from app.api import _safe_local_origin
    from app.main import fastapi_app

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(
        transport=transport, base_url="http://localhost:8000", follow_redirects=False
    ) as client:
        for path in ("/", "/home", "/auth/login", "/api/v1/auth/oauth/42/callback"):
            resp = await client.get(path)
            content_type = resp.headers.get("content-type", "")
            assert "text/html" not in content_type, (
                f"{path} returned unexpected content-type {content_type}"
            )

        root_resp = await client.get("/")
        assert root_resp.status_code == 307
        assert root_resp.headers["location"].endswith("/discover")

        home_resp = await client.get("/home")
        assert home_resp.status_code == 404

        login_resp = await client.get(
            "/auth/login",
            headers={"X-Forwarded-Proto": "https", "X-Forwarded-Host": "localhost:8443"},
        )
        assert login_resp.status_code == 307
        raw_cookie = login_resp.cookies.get("oauth_frontend_origin")
        assert _safe_local_origin(raw_cookie) == "https://localhost:8443"

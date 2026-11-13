from __future__ import annotations

import io
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import engine
from app.main import app as asgi_app
from app.main import fastapi_app
from app.oauth import manager as oauth_manager
from app.oauth.user import Users
from app.realtime.presence import presence_manager
from app.user.profile import avatar as avatar_mod


@pytest.fixture(autouse=True)
async def dispose_engine_connections() -> None:
    await engine.dispose()
    yield
    await engine.dispose()


def _make_png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (0, 120, 220)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_email_signup_keeps_default_avatar_and_profile_lifecycle() -> None:
    """Verify email users start with avatar_url=None and can update bio + upload/fetch/delete avatar."""
    assert asgi_app is not None
    login = f"prof_{uuid.uuid4().hex[:8]}"
    email = f"{login}@1337.ma"
    created_id: uuid.UUID | None = None
    uploaded_file: Path | None = None

    try:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            unauth = await client.get("/api/v1/users/me")
            assert unauth.status_code == 401

            reg_res = await client.post(
                "/api/v1/auth/register",
                json={
                    "login": login,
                    "email": email,
                    "fullname": "Email Student",
                    "password": "Password123!",
                },
            )
            assert reg_res.status_code == 201
            reg_user = reg_res.json()["user"]
            created_id = uuid.UUID(reg_user["id"])
            assert reg_user["avatar_url"] is None

            me_res = await client.get("/api/v1/users/me")
            assert me_res.status_code == 200
            me_data = me_res.json()
            assert me_data["bio"] is None
            assert me_data["avatar_url"] is None
            assert "profile:edit_own" in me_data["permissions"]

            put_res = await client.put(
                "/api/v1/users/me",
                json={"fullname": "Updated Name", "bio": "Systems & web dev"},
            )
            assert put_res.status_code == 200
            assert put_res.json()["fullname"] == "Updated Name"
            assert put_res.json()["bio"] == "Systems & web dev"

            bad_upload = await client.post(
                "/api/v1/users/me/avatar",
                files={"file": ("bad.png", b"not-an-image", "image/png")},
            )
            assert bad_upload.status_code == 422

            png_bytes = _make_png_bytes()
            up_res = await client.post(
                "/api/v1/users/me/avatar",
                files={"file": ("avatar.png", png_bytes, "image/png")},
            )
            assert up_res.status_code == 200
            avatar_url = up_res.json()["avatar_url"]
            assert avatar_url.startswith("/media/avatars/")
            uploaded_file = avatar_mod.AVATAR_DIR / Path(avatar_url).name
            assert uploaded_file.exists()

            # Fetching the returned avatar URL through the app returns 200 image/webp
            fetch_avatar = await client.get(avatar_url)
            assert fetch_avatar.status_code == 200
            assert fetch_avatar.headers.get("content-type") == "image/webp"
            assert len(fetch_avatar.content) > 0

            del_res = await client.delete("/api/v1/users/me/avatar")
            assert del_res.status_code == 200
            assert del_res.json()["avatar_url"] is None
            assert not uploaded_file.exists()

            pub_res = await client.get(f"/api/v1/users/{login}")
            assert pub_res.status_code == 200
            assert pub_res.json()["bio"] == "Systems & web dev"
    finally:
        if uploaded_file is not None:
            uploaded_file.unlink(missing_ok=True)
        if created_id is not None:
            async with AsyncSession(engine, expire_on_commit=False) as session:
                await session.execute(delete(Users).where(Users.id == created_id))
                await session.commit()


@pytest.mark.asyncio
async def test_intra_manage_user_fetches_and_preserves_custom_avatar() -> None:
    """Verify 42 Intra /v2/me payload syncs image.link/versions, respects custom /media uploads, and handles missing images."""
    unique = uuid.uuid4().hex[:6]
    intra_login = f"intra_{unique}"
    intra_id = 900000 + int(unique[:4], 16)
    no_img_id = intra_id + 1
    created_ids: list[uuid.UUID] = []

    sample_42_v2_me_payload = {
        "id": intra_id,
        "email": f"{intra_login}@student.1337.ma",
        "login": intra_login,
        "first_name": "Zoubair",
        "last_name": "Bakkas",
        "usual_full_name": "Zoubair Bakkas",
        "displayname": "Zoubair Bakkas",
        "kind": "student",
        "image": {
            "link": f"https://cdn.intra.42.fr/users/123456/{intra_login}.jpg",
            "versions": {
                "large": f"https://cdn.intra.42.fr/users/123456/large_{intra_login}.jpg",
                "medium": f"https://cdn.intra.42.fr/users/123456/medium_{intra_login}.jpg",
                "small": f"https://cdn.intra.42.fr/users/123456/small_{intra_login}.jpg",
                "micro": f"https://cdn.intra.42.fr/users/123456/micro_{intra_login}.jpg",
            },
        },
        "campus": [{"id": 21, "name": "Benguerir"}],
    }

    try:
        # 1. Pre-create an email user with the same login (no intra_id)
        async with AsyncSession(engine, expire_on_commit=False) as session:
            collision_user = Users(
                login=intra_login,
                email=f"{intra_login}@email.ma",
                fullname="Email Collision User",
                role="user",
            )
            session.add(collision_user)
            await session.commit()
            await session.refresh(collision_user)
            created_ids.append(collision_user.id)

        # 2. First 42 Intra login via /api/v1/auth/oauth/42/callback with sample /v2/me payload
        with (
            patch(
                "app.oauth.manager.get_access_token",
                new=AsyncMock(return_value={"access_token": "mock_42_access_token"}),
            ),
            patch(
                "app.oauth.manager.get_user",
                new=AsyncMock(return_value=sample_42_v2_me_payload),
            ),
        ):
            transport = ASGITransport(app=fastapi_app)
            async with AsyncClient(
                transport=transport, base_url="http://localhost:8000", follow_redirects=False
            ) as client:
                client.cookies.set("state", "test_state_123")
                client.cookies.set("code_verifier", "test_verifier_123")
                client.cookies.set("oauth_frontend_origin", "https://localhost:8443")

                cb_res = await client.get(
                    "/api/v1/auth/oauth/42/callback",
                    params={"code": "oauth_code_abc", "state": "test_state_123"},
                )
                assert cb_res.status_code == 303
                assert cb_res.headers["location"] == "https://localhost:8443/discover"
                assert "access_token" in cb_res.cookies

                client.cookies.set("access_token", cb_res.cookies["access_token"])
                me_res = await client.get("/api/v1/users/me")
                assert me_res.status_code == 200
                me_json = me_res.json()
                first_id = uuid.UUID(me_json["id"])
                created_ids.append(first_id)
                assert first_id != created_ids[0]
                assert me_json["login"] == f"{intra_login}-42"
                assert (
                    me_json["avatar_url"]
                    == f"https://cdn.intra.42.fr/users/123456/{intra_login}.jpg"
                )

        # 3. Pre-existing 42 user with avatar_url=None gets refreshed from image.versions fallback
        async with AsyncSession(engine, expire_on_commit=False) as session:
            db_user = await session.scalar(select(Users).where(Users.id == first_id))
            assert db_user is not None
            db_user.avatar_url = None
            await session.commit()

        second = await oauth_manager.manage_user(
            {
                "id": intra_id,
                "login": intra_login,
                "displayname": "Zoubair Bakkas",
                "image": {
                    "link": None,
                    "versions": {
                        "medium": f"https://cdn.intra.42.fr/users/123456/medium_{intra_login}.jpg"
                    },
                },
            }
        )
        assert second.id == first_id
        assert second.avatar_url == f"https://cdn.intra.42.fr/users/123456/medium_{intra_login}.jpg"

        # 4. Custom uploaded /media/avatars/ photo is preserved on Intra login
        async with AsyncSession(engine, expire_on_commit=False) as session:
            db_user = await session.scalar(select(Users).where(Users.id == first_id))
            assert db_user is not None
            db_user.avatar_url = "/media/avatars/custom.webp"
            await session.commit()

        third = await oauth_manager.manage_user(sample_42_v2_me_payload)
        assert third.avatar_url == "/media/avatars/custom.webp"

        # 5. Missing Intra image defaults to avatar_url=None (initials fallback)
        no_img_user = await oauth_manager.manage_user(
            {
                "id": no_img_id,
                "login": f"noimg_{unique}",
                "displayname": "No Image Student",
                "image": {"link": None, "versions": {"medium": None, "small": None}},
            }
        )
        created_ids.append(no_img_user.id)
        assert no_img_user.avatar_url is None
    finally:
        if created_ids:
            async with AsyncSession(engine, expire_on_commit=False) as session:
                await session.execute(delete(Users).where(Users.id.in_(created_ids)))
                await session.commit()


@pytest.mark.asyncio
async def test_chat_peers_requires_auth_and_tracks_presence() -> None:
    """Verify /messages/peers never seeds DEV_PEERS, requires auth, and marks online presence."""
    login1 = f"peer1_{uuid.uuid4().hex[:6]}"
    login2 = f"peer2_{uuid.uuid4().hex[:6]}"
    user_ids: list[uuid.UUID] = []

    try:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            unauth = await client.get("/messages/peers")
            assert unauth.status_code == 401

            r1 = await client.post(
                "/api/v1/auth/register",
                json={
                    "login": login1,
                    "email": f"{login1}@1337.ma",
                    "fullname": "Peer One",
                    "password": "Password123!",
                },
            )
            assert r1.status_code == 201
            u1_id = r1.json()["user"]["id"]
            token1 = r1.json()["access_token"]
            user_ids.append(uuid.UUID(u1_id))

            r2 = await client.post(
                "/api/v1/auth/register",
                json={
                    "login": login2,
                    "email": f"{login2}@1337.ma",
                    "fullname": "Peer Two",
                    "password": "Password123!",
                },
            )
            assert r2.status_code == 201
            u2_id = r2.json()["user"]["id"]
            user_ids.append(uuid.UUID(u2_id))

            presence_manager.add_connection(u2_id, "test_sid_peer2")
            try:
                peers_res = await client.get(
                    "/messages/peers",
                    headers={"Authorization": f"Bearer {token1}"},
                )
                assert peers_res.status_code == 200
                peers = peers_res.json()
                p1 = next(p for p in peers if p["id"] == u1_id)
                p2 = next(p for p in peers if p["id"] == u2_id)
                assert p1["is_self"] is True
                assert p2["is_online"] is True
                assert not any(p["login"] == "sel-bou" for p in peers)

                other_id = str(uuid.uuid4())
                forbidden = await client.get(
                    f"/messages/{u2_id}/{other_id}",
                    headers={"Authorization": f"Bearer {token1}"},
                )
                assert forbidden.status_code == 403
            finally:
                presence_manager.remove_connection("test_sid_peer2")
    finally:
        if user_ids:
            async with AsyncSession(engine, expire_on_commit=False) as session:
                await session.execute(delete(Users).where(Users.id.in_(user_ids)))
                await session.commit()

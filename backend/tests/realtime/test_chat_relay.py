from __future__ import annotations

import uuid
from unittest.mock import AsyncMock

import pytest

from app.realtime.namespaces.chat import ChatNamespace


@pytest.mark.asyncio
async def test_chat_namespace_configuration() -> None:
    ns = ChatNamespace("/chat")
    assert ns.namespace == "/chat"


@pytest.mark.asyncio
async def test_chat_send_dm_validation() -> None:
    ns = ChatNamespace("/chat")

    # 1. Invalid payload
    res = await ns.on_send_dm("sid1", "not a dict")
    assert res["status"] == "error"
    assert "Invalid message payload" in res["message"]

    # 2. Invalid receiver_id
    res = await ns.on_send_dm("sid1", {"receiver_id": "not-a-uuid", "content": "hi"})
    assert res["status"] == "error"
    assert "receiver_id must be a valid UUID" in res["message"]

    # 3. Empty content
    res = await ns.on_send_dm("sid1", {"receiver_id": str(uuid.uuid4()), "content": "  "})
    assert res["status"] == "error"
    assert "content is required" in res["message"]

    # 4. Unauthenticated sender
    ns.get_session = AsyncMock(return_value={})
    res = await ns.on_send_dm("sid1", {"receiver_id": str(uuid.uuid4()), "content": "Hello"})
    assert res["status"] == "error"
    assert "not authenticated" in res["message"]


@pytest.mark.asyncio
async def test_chat_dm_read_validation() -> None:
    ns = ChatNamespace("/chat")

    # 1. Invalid payload
    res = await ns.on_dm_read("sid1", "invalid")
    assert res["status"] == "error"

    # 2. Invalid message_id
    res = await ns.on_dm_read("sid1", {"message_id": "bad-uuid"})
    assert res["status"] == "error"
    assert "valid UUID" in res["message"]

    # 3. Unauthenticated session
    ns.get_session = AsyncMock(return_value={})
    res = await ns.on_dm_read("sid1", {"message_id": str(uuid.uuid4())})
    assert res["status"] == "error"
    assert "not authenticated" in res["message"]

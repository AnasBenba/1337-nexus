import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # 1. Get dev tokens
        res_anas = await client.get("/api/v1/auth/dev-token?login=anas")
        assert res_anas.status_code == 200, f"anas login failed: {res_anas.text}"
        data_anas = res_anas.json()
        token_anas = data_anas["token"]
        anas_id = data_anas["user"]["id"]
        print(f"[*] Anas dev_token acquired: id={anas_id}")

        res_yassine = await client.get("/api/v1/auth/dev-token?login=yassine")
        assert res_yassine.status_code == 200, f"yassine login failed: {res_yassine.text}"
        data_yassine = res_yassine.json()
        token_yassine = data_yassine["token"]
        yassine_id = data_yassine["user"]["id"]
        print(f"[*] Yassine dev_token acquired: id={yassine_id}")

        # 2. Test multi-tab isolation: Bearer token precedence
        headers_anas = {"Authorization": f"Bearer {token_anas}"}
        cookies_yassine = {"access_token": token_yassine}

        res_profile = await client.get("/api/v1/profile/me", headers=headers_anas, cookies=cookies_yassine)
        assert res_profile.status_code == 200
        assert res_profile.json()["login"] == "anas", "Bearer header precedence failed!"
        print("[+] SUCCESS: Bearer token takes priority over cookies - multi-tab isolation works!")

        # 3. Clean up any existing friendship between them to start fresh
        await client.delete(f"/api/v1/friends/{yassine_id}", headers=headers_anas)

        # 4. Anas sends friend request to Yassine
        res_add = await client.post(f"/api/v1/friends/{yassine_id}", headers=headers_anas)
        assert res_add.status_code in [200, 201], f"add friend failed: {res_add.text}"
        print(f"[+] Anas sent friend request: {res_add.json()}")

        # 5. Yassine checks friend requests
        headers_yassine = {"Authorization": f"Bearer {token_yassine}"}
        res_reqs = await client.get("/api/v1/friends/requests", headers=headers_yassine)
        assert res_reqs.status_code == 200
        reqs_data = res_reqs.json()
        incoming = reqs_data.get("incoming", [])
        assert any(r["user"]["login"] == "anas" for r in incoming), f"Anas not in incoming: {incoming}"
        print(f"[+] SUCCESS: Yassine received incoming friend request from Anas (Count={len(incoming)})")

        # 6. Yassine accepts the request
        res_accept = await client.post(f"/api/v1/friends/{anas_id}/accept", headers=headers_yassine)
        assert res_accept.status_code == 200, f"accept failed: {res_accept.text}"
        print(f"[+] SUCCESS: Yassine accepted friend request: {res_accept.json()}")

        # 7. Verify both users are now friends
        res_anas_friends = await client.get("/api/v1/friends", headers=headers_anas)
        assert res_anas_friends.status_code == 200
        assert any(f["login"] == "yassine" for f in res_anas_friends.json())

        res_yassine_friends = await client.get("/api/v1/friends", headers=headers_yassine)
        assert res_yassine_friends.status_code == 200
        assert any(f["login"] == "anas" for f in res_yassine_friends.json())
        print("[+] SUCCESS: Mutual friendship confirmed for both Anas and Yassine!")

        # 8. Test chat message exchange
        res_send = await client.post("/api/v1/chat/messages", headers=headers_anas, json={
            "receiver_id": yassine_id,
            "content": "Hello Yassine! Testing real-time messaging."
        })
        assert res_send.status_code in [200, 201], f"send message failed: {res_send.text}"
        msg_data = res_send.json()
        print(f"[+] Anas sent message: id={msg_data.get('id')}")

        # 9. Yassine reads message history
        res_history = await client.get(f"/api/v1/chat/messages/{anas_id}", headers=headers_yassine)
        assert res_history.status_code == 200
        history = res_history.json()
        assert len(history) > 0
        last_msg = history[-1]
        assert last_msg["sender_id"] == anas_id
        assert last_msg["receiver_id"] == yassine_id
        assert "Hello Yassine!" in last_msg["content"]
        print(f"[+] SUCCESS: Message thread verified: sender={last_msg['sender_id']}, receiver={last_msg['receiver_id']}")
        print("[***] ALL INTERACTION VERIFICATIONS PASSED SUCCESSFULLY [***]")

if __name__ == "__main__":
    asyncio.run(main())

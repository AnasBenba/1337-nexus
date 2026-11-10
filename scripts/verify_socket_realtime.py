import asyncio
import httpx
import socketio

async def main():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as http:
        r_anas = await http.get("/api/v1/auth/dev-token?login=anas")
        token_anas = r_anas.json()["token"]
        anas_id = r_anas.json()["user"]["id"]

        r_yassine = await http.get("/api/v1/auth/dev-token?login=yassine")
        token_yassine = r_yassine.json()["token"]
        yassine_id = r_yassine.json()["user"]["id"]

    # Connect Socket.IO clients
    sio_anas = socketio.AsyncClient()
    sio_yassine = socketio.AsyncClient()

    yassine_received = asyncio.Event()
    received_payload = {}

    @sio_yassine.on("receive_dm", namespace="/chat")
    async def on_receive_dm(data):
        print(f"[Socket Yassine] Received real-time DM: {data}")
        received_payload.update(data)
        yassine_received.set()

    print("[*] Connecting Anas to /chat namespace...")
    await sio_anas.connect(
        "http://localhost:8000",
        namespaces=["/chat"],
        auth={"token": token_anas},
        socketio_path="/socket.io",
        transports=["websocket", "polling"],
    )

    print("[*] Connecting Yassine to /chat namespace...")
    await sio_yassine.connect(
        "http://localhost:8000",
        namespaces=["/chat"],
        auth={"token": token_yassine},
        socketio_path="/socket.io",
        transports=["websocket", "polling"],
    )

    await asyncio.sleep(0.5)

    test_msg = "Real-time socket test: Hello Yassine without page refresh!"
    print(f"[*] Anas emitting send_dm to Yassine (id={yassine_id})...")
    
    ack = await sio_anas.call(
        "send_dm",
        {"receiver_id": yassine_id, "content": test_msg},
        namespace="/chat",
        timeout=5,
    )
    print(f"[Socket Anas] send_dm ack received: {ack}")
    assert ack.get("status") == "ok"
    assert ack.get("delivered") is True, f"Expected delivered=True because Yassine is connected, got {ack}"

    # Wait for Yassine to receive
    try:
        await asyncio.wait_for(yassine_received.wait(), timeout=5.0)
    except asyncio.TimeoutError:
        raise AssertionError("Yassine did NOT receive real-time DM event within timeout!")

    assert received_payload.get("from") == anas_id
    assert received_payload.get("content") == test_msg
    print("[+] SUCCESS: Yassine received real-time DM instantly via Socket.IO!")

    await sio_anas.disconnect()
    await sio_yassine.disconnect()
    print("[***] REALTIME SOCKET.IO TEST PASSED COMPLETELY [***]")

if __name__ == "__main__":
    asyncio.run(main())

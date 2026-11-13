from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_dms: dict[Any, WebSocket] = {}
        self.active_teams: dict[Any, dict[Any, WebSocket]] = {}

    async def connect_dm(self, user_id: Any, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_dms[user_id] = websocket

    def disconnect_dm(self, user_id: Any) -> None:
        self.active_dms.pop(user_id, None)

    async def send_dm(self, message: str, user_id: Any) -> bool:
        ws = self.active_dms.get(user_id)
        if ws:
            await ws.send_text(message)
            return True
        return False

    async def connect_team(self, team_id: Any, user_id: Any, websocket: WebSocket) -> None:
        await websocket.accept()
        if team_id not in self.active_teams:
            self.active_teams[team_id] = {}
        self.active_teams[team_id][user_id] = websocket

    def disconnect_team(self, team_id: Any, user_id: Any) -> None:
        if team_id in self.active_teams:
            self.active_teams[team_id].pop(user_id, None)
            if not self.active_teams[team_id]:
                del self.active_teams[team_id]

    async def broadcast_to_team(self, team_id: Any, sender_id: Any, message: str) -> None:
        if team_id in self.active_teams:
            disconnected_members = []
            for member_id, ws in list(self.active_teams[team_id].items()):
                if member_id != sender_id:  # Don't echo back to sender
                    try:
                        await ws.send_text(message)
                    except Exception:
                        disconnected_members.append(member_id)

            for member_id in disconnected_members:
                self.disconnect_team(team_id, member_id)


manager = ConnectionManager()

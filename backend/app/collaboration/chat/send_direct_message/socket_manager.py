from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_dms: dict[UUID, WebSocket] = {}
        self.active_teams: dict[int, dict[UUID, WebSocket]] = {}

    async def connect_dm(self, user_id: UUID, websocket: WebSocket):
        await websocket.accept()
        self.active_dms[user_id] = websocket

    def disconnect_dm(self, user_id: UUID):
        self.active_dms.pop(user_id, None)

    async def send_dm(self, message: str, user_id: UUID) -> bool:
        ws = self.active_dms.get(user_id)
        if ws:
            await ws.send_text(message)
            return True
        return False

    async def connect_team(self, team_id: int, user_id: UUID, websocket: WebSocket):
        await websocket.accept()
        if team_id not in self.active_teams:
            self.active_teams[team_id] = {}
        self.active_teams[team_id][user_id] = websocket

    def disconnect_team(self, team_id: int, user_id: UUID):
        if team_id in self.active_teams:
            self.active_teams[team_id].pop(user_id, None)
            if not self.active_teams[team_id]:
                del self.active_teams[team_id]

    async def broadcast_to_team(self, team_id: int, sender_id: UUID, message: str):
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
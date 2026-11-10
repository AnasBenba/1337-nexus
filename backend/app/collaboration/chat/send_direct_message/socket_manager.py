from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_dms: dict[str, WebSocket] = {}
        self.active_teams: dict[str, dict[str, WebSocket]] = {}

    def _key(self, user_id: UUID | str | int) -> str:
        return str(user_id)

    async def connect_dm(self, user_id: UUID | str | int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_dms[self._key(user_id)] = websocket

    def disconnect_dm(self, user_id: UUID | str | int) -> None:
        self.active_dms.pop(self._key(user_id), None)

    async def send_dm(self, message: str, user_id: UUID | str | int) -> bool:
        ws = self.active_dms.get(self._key(user_id))
        if ws:
            try:
                await ws.send_text(message)
                return True
            except Exception:
                self.disconnect_dm(user_id)
        return False

    async def connect_team(
        self, team_id: UUID | str | int, user_id: UUID | str | int, websocket: WebSocket
    ) -> None:
        await websocket.accept()
        tkey = self._key(team_id)
        ukey = self._key(user_id)
        if tkey not in self.active_teams:
            self.active_teams[tkey] = {}
        self.active_teams[tkey][ukey] = websocket

    def disconnect_team(self, team_id: UUID | str | int, user_id: UUID | str | int) -> None:
        tkey = self._key(team_id)
        ukey = self._key(user_id)
        if tkey in self.active_teams:
            self.active_teams[tkey].pop(ukey, None)
            if not self.active_teams[tkey]:
                del self.active_teams[tkey]

    async def broadcast_to_team(
        self, team_id: UUID | str | int, sender_id: UUID | str | int, message: str
    ) -> None:
        tkey = self._key(team_id)
        skey = self._key(sender_id)
        if tkey in self.active_teams:
            disconnected_members = []
            for member_id, ws in list(self.active_teams[tkey].items()):
                if member_id != skey:
                    try:
                        await ws.send_text(message)
                    except Exception:
                        disconnected_members.append(member_id)

            for member_id in disconnected_members:
                self.disconnect_team(team_id, member_id)


manager = ConnectionManager()

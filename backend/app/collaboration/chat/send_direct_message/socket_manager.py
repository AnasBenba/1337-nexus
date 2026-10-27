from fastapi import WebSocket 
from uuid import UUID  
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[UUID, WebSocket] = {}
    
    async def connect(self, user_id: UUID, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: UUID):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: str, receiver_id: UUID):
        if receiver_id in self.active_connections:
            websocket = self.active_connections.get(receiver_id)
        else:
            websocket = None
        if websocket:
            await websocket.send_text(message)

manager = ConnectionManager()
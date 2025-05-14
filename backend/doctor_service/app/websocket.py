# doctor_service/app/websocket.py
import asyncio
import json
import uuid
import logging
from typing import Dict, List, Set, Any
from fastapi import WebSocket, WebSocketDisconnect, Depends
import jwt

from app.config import settings
from app.exceptions import UnauthorizedException

class ConnectionManager:
    def __init__(self):
        # Store active connections: {user_id: {connection_id: WebSocket}}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # Keep track of connection to user mapping
        self.connection_to_user: Dict[str, str] = {}
        
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        
        # Generate a unique connection ID
        connection_id = str(uuid.uuid4())
        
        # Initialize user's connections dict if not exists
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
            
        # Add this connection
        self.active_connections[user_id][connection_id] = websocket
        self.connection_to_user[connection_id] = user_id
        
        # Return the connection ID for later reference
        return connection_id
        
    def disconnect(self, connection_id: str):
        if connection_id not in self.connection_to_user:
            return
            
        user_id = self.connection_to_user[connection_id]
        
        # Remove this specific connection
        if user_id in self.active_connections and connection_id in self.active_connections[user_id]:
            del self.active_connections[user_id][connection_id]
            
            # If no more connections for this user, clean up
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                
        # Remove from connection tracking
        del self.connection_to_user[connection_id]
        
    async def send_personal_message(self, user_id, message):
        """
        Send a message to a specific user via WebSocket.
        
        Args:
            user_id (str): The ID of the user to send the message to.
            message (dict): The message to send.
        """
        # Ensure user_id is a string
        user_id = str(user_id)
        
        if user_id in self.active_connections:
            # Send to all connections of this user
            for websocket in self.active_connections[user_id].values():
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logging.error(f"Failed to send WebSocket message to user {user_id}: {str(e)}")
        else:
            logging.info(f"No active WebSocket connections for user {user_id}")
            
    async def broadcast(self, message: Dict[str, Any]):
        for user_connections in self.active_connections.values():
            for websocket in user_connections.values():
                await websocket.send_text(json.dumps(message))
                
    async def broadcast_to_role(self, message: Dict[str, Any], role: str, pool):
        """Send message to all users with specific role"""
        async with pool.acquire() as conn:
            query = "SELECT id FROM users WHERE role = $1 AND is_active = true"
            user_ids = await conn.fetch(query, role)
            
            for record in user_ids:
                user_id = str(record['id'])
                await self.send_personal_message(message, user_id)

# Create a global connection manager
manager = ConnectionManager()

async def get_websocket_user(websocket: WebSocket):
    """Authenticate user from websocket token"""
    try:
        # Get token from query parameter
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=1008, reason="Missing authentication token")
            return None
            
        # Verify token
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        user_role = payload.get("role")
        
        if not user_id:
            await websocket.close(code=1008, reason="Invalid authentication token")
            return None
            
        return {"id": user_id, "role": user_role}
        
    except jwt.PyJWTError:
        await websocket.close(code=1008, reason="Invalid authentication token")
        return None
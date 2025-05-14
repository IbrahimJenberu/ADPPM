"""
WebSocket connection manager and handler functions.
"""
from fastapi import WebSocket, WebSocketDisconnect, Depends, Query
from typing import Dict, Set, Any, List, Optional
import json
import logging
import uuid
from asyncpg import Connection
from app.dependencies import get_db_connection
from app.security import TokenValidator

class WebSocketConnectionManager:
    """Manages active WebSocket connections."""
    
    def __init__(self):
        # Maps user_id to a set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps connection_id to user_id for easy lookup
        self.connection_map: Dict[str, str] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept connection and register it."""
        await websocket.accept()
        
        # Generate a unique connection ID
        connection_id = str(uuid.uuid4())
        websocket.scope["connection_id"] = connection_id
        
        # Add to active connections
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)
        self.connection_map[connection_id] = user_id
        
        logging.info(f"WebSocket connected: User {user_id}, Connection {connection_id}")
        
        return connection_id
    
    async def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection."""
        connection_id = websocket.scope.get("connection_id")
        
        if connection_id and connection_id in self.connection_map:
            user_id = self.connection_map[connection_id]
            
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                
                # Clean up if no more connections for this user
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            
            del self.connection_map[connection_id]
            logging.info(f"WebSocket disconnected: User {user_id}, Connection {connection_id}")
    
    async def send_personal_message(self, user_id: str, message: Dict[str, Any]):
        """Send message to a specific user across all their connections."""
        if user_id in self.active_connections:
            disconnected = set()
            
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logging.error(f"Error sending message to {user_id}: {str(e)}")
                    disconnected.add(websocket)
            
            # Clean up any disconnected websockets
            for websocket in disconnected:
                await self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any], exclude: Optional[List[str]] = None):
        """Broadcast message to all connected clients, with optional exclusions."""
        exclude_set = set(exclude) if exclude else set()
        disconnected = []
        
        for user_id, connections in self.active_connections.items():
            if user_id in exclude_set:
                continue
            
            for websocket in connections:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logging.error(f"Error broadcasting to {user_id}: {str(e)}")
                    disconnected.append((user_id, websocket))
        
        # Clean up disconnected
        for user_id, websocket in disconnected:
            await self.disconnect(websocket)

# Create global connection manager
connection_manager = WebSocketConnectionManager()

async def get_token_from_query(
    token: str = Query(..., description="JWT token for authentication")
) -> Dict[str, Any]:
    """Validate token from query parameter."""
    validator = TokenValidator()
    # Create a mock HTTPAuthorizationCredentials
    class MockCredentials:
        def __init__(self, token):
            self.credentials = token
            self.scheme = "Bearer"
    
    return await validator.validate_token(MockCredentials(token))

async def websocket_endpoint(
    websocket: WebSocket,
    token_data: Dict[str, Any] = Depends(get_token_from_query),
    db: Connection = Depends(get_db_connection)
):
    """WebSocket endpoint handler."""
    user_id = token_data.get("user_id")
    
    if not user_id:
        await websocket.close(code=1008)  # Policy violation
        return
    
    connection_id = await connection_manager.connect(websocket, user_id)
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connection_established",
            "data": {
                "user_id": user_id,
                "connection_id": connection_id,
                "role": token_data.get("role")
            }
        })
        
        # Main message loop
        while True:
            # Wait for messages from the client
            message = await websocket.receive_text()
            data = json.loads(message)
            
            # Process client messages if needed
            # For now, we're just echoing back the message
            await websocket.send_json({
                "type": "echo",
                "data": data
            })
            
    except WebSocketDisconnect:
        # Client disconnected
        await connection_manager.disconnect(websocket)
    except Exception as e:
        logging.exception(f"WebSocket error: {str(e)}")
        await connection_manager.disconnect(websocket)
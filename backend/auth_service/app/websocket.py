"""WebSocket handlers for real-time notifications."""
import json
import logging
from typing import Dict, List, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
import asyncio

from .dependencies import get_current_user
from .database import get_db_pool as get_db_conn

# Set up logging
logger = logging.getLogger("auth_service.websocket")

# WebSocket router
router = APIRouter()

# Connected WebSocket clients
class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        """Initialize the connection manager."""
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """
        Connect a WebSocket client.
        
        Args:
            websocket: WebSocket connection
            user_id: User ID
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"New WebSocket connection for user {user_id}. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """
        Disconnect a WebSocket client.
        
        Args:
            websocket: WebSocket connection
            user_id: User ID
        """
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket connection closed for user {user_id}. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: Dict[str, Any], user_id: str):
        """
        Send a message to a specific user.
        
        Args:
            message: Message to send
            user_id: User ID
        """
        if user_id in self.active_connections:
            disconnected_websockets = []
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending WebSocket message: {e}")
                    disconnected_websockets.append(websocket)
            
            # Clean up disconnected websockets
            for websocket in disconnected_websockets:
                self.disconnect(websocket, user_id)
    
    async def broadcast(self, message: Dict[str, Any]):
        """
        Broadcast a message to all connected clients.
        
        Args:
            message: Message to broadcast
        """
        disconnected_connections = []
        for user_id, connections in self.active_connections.items():
            disconnected_websockets = []
            for websocket in connections:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error broadcasting WebSocket message: {e}")
                    disconnected_websockets.append(websocket)
            
            # Clean up disconnected websockets
            for websocket in disconnected_websockets:
                self.disconnect(websocket, user_id)
            
            if not self.active_connections.get(user_id):
                disconnected_connections.append(user_id)
        
        # Clean up empty user connections
        for user_id in disconnected_connections:
            if user_id in self.active_connections:
                del self.active_connections[user_id]

# Create connection manager instance
manager = ConnectionManager()

@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    """
    WebSocket endpoint for notifications.
    
    Args:
        websocket: WebSocket connection
    """
    # Accept connection
    await websocket.accept()
    
    try:
        # Get the token from the first message
        data = await websocket.receive_text()
        try:
            auth_data = json.loads(data)
            token = auth_data.get("token")
            
            if not token:
                await websocket.send_text(json.dumps({"error": "Authentication required"}))
                await websocket.close(1008)  # Policy violation
                return
            
            # Verify token and get user
            try:
                conn = await get_db_conn().asend(None)
                user = await get_current_user(token, conn)
                user_id = user["id"]
                
                # Connect the user
                await manager.connect(websocket, user_id)
                
                # Send initial notification
                await websocket.send_text(json.dumps({
                    "type": "connection_established",
                    "data": {"user_id": user_id}
                }))
                
                # Listen for messages
                while True:
                    data = await websocket.receive_text()
                    try:
                        message = json.loads(data)
                        # Process message if needed
                        await websocket.send_text(json.dumps({
                            "type": "message_received",
                            "data": {"received": True}
                        }))
                    except json.JSONDecodeError:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "data": {"message": "Invalid JSON format"}
                        }))
                
            except Exception as e:
                logger.error(f"Authentication error: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "data": {"message": "Authentication failed"}
                }))
                await websocket.close(1008)  # Policy violation
                
        except json.JSONDecodeError:
            await websocket.send_text(json.dumps({
                "type": "error",
                "data": {"message": "Invalid JSON format"}
            }))
            await websocket.close(1003)  # Unsupported data
            
    except WebSocketDisconnect:
        # Handle disconnection
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close(1011)  # Internal error
        except:
            pass

async def send_notification(user_id: str, notification: Dict[str, Any]):
    """
    Send a notification to a user.
    
    Args:
        user_id: User ID
        notification: Notification data
    """
    try:
        await manager.send_personal_message({
            "type": "notification",
            "data": notification
        }, user_id)
    except Exception as e:
        logger.error(f"Error sending notification: {e}")
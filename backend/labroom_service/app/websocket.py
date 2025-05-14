# labroom_service/app/websocket.py
import asyncio
import json
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect, Depends, Query, status
import logging
import jwt
from .config import settings

logger = logging.getLogger(__name__)

# Dictionary to track active connections
active_connections = {}

# Store active WebSocket connections
connected_clients: Dict[str, Set[WebSocket]] = {}

# Message queue for each user
message_queues: Dict[str, asyncio.Queue] = {}

async def authenticate_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
) -> Optional[Dict[str, Any]]:
    """Authenticate WebSocket connection using JWT token"""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.PyJWTError as e:
        logger.error(f"WebSocket authentication error: {str(e)}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    
    
import json
import logging
import asyncio
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime
import uuid

# Store connected clients by user_id
connected_clients: Dict[str, Set[WebSocket]] = {}
logger = logging.getLogger(__name__)

async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates.
    Expects a user_id in the query parameters.
    """
    user_id = websocket.query_params.get("user_id")
    if not user_id:
        await websocket.close(code=1008, reason="Missing user_id parameter")
        return
    
    await websocket.accept()
    
    # Add client to connected clients
    if user_id not in connected_clients:
        connected_clients[user_id] = set()
    connected_clients[user_id].add(websocket)
    
    try:
        # Send initial connection success message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Real-time connection established",
            "timestamp": datetime.now().isoformat()
        })
        
        # Listen for messages from the client
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different types of client messages
            message_type = message.get("type")
            
            if message_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})
            elif message_type == "mark_read":
                # Handle mark as read request
                if "lab_request_id" in message:
                    lab_request_id = message["lab_request_id"]
                    from .database import get_connection, update
                    
                    conn = await get_connection()
                    try:
                        update_data = {
                            "is_read": True,
                            "read_at": datetime.now()
                        }
                        success = await update("lab_requests", lab_request_id, update_data, conn=conn)
                        
                        if success:
                            # Add to events
                            event_data = {
                                "lab_request_id": lab_request_id,
                                "event_type": "read",
                                "user_id": user_id,
                                "details": json.dumps({"marked_read_by": user_id})
                            }
                            
                            await conn.execute("""
                                INSERT INTO lab_request_events 
                                (lab_request_id, event_type, user_id, details)
                                VALUES ($1, $2, $3, $4)
                            """, event_data["lab_request_id"], event_data["event_type"], 
                                event_data["user_id"], event_data["details"])
                                
                            # Send confirmation
                            await websocket.send_json({
                                "type": "mark_read_success",
                                "lab_request_id": lab_request_id,
                                "timestamp": datetime.now().isoformat()
                            })
                            
                            # Broadcast update to all connected clients for this user
                            await broadcast_to_user(user_id, {
                                "type": "lab_request_updated",
                                "lab_request_id": lab_request_id,
                                "updates": {"is_read": True}
                            })
                        else:
                            await websocket.send_json({
                                "type": "mark_read_error",
                                "lab_request_id": lab_request_id,
                                "message": "Failed to mark request as read",
                                "timestamp": datetime.now().isoformat()
                            })
                    finally:
                        await conn.close()
            
    except WebSocketDisconnect:
        # Remove client on disconnect
        if user_id in connected_clients:
            connected_clients[user_id].remove(websocket)
            if not connected_clients[user_id]:
                del connected_clients[user_id]
        logger.info(f"Client disconnected: {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        # Remove client on error
        if user_id in connected_clients:
            connected_clients[user_id].remove(websocket)
            if not connected_clients[user_id]:
                del connected_clients[user_id]

async def broadcast_to_user(user_id: str, message: Dict[str, Any]):
    """
    Broadcast a message to all connections for a specific user.
    """
    if user_id in connected_clients:
        disconnected = set()
        for websocket in connected_clients[user_id]:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.add(websocket)
        
        # Remove disconnected clients
        for websocket in disconnected:
            connected_clients[user_id].remove(websocket)
        
        if not connected_clients[user_id]:
            del connected_clients[user_id]


async def broadcast_lab_request(lab_request_id: str, event_type: str, data: Dict[str, Any] = None):
    """
    Broadcast lab request updates to all connected lab technicians.
    This is used when a new lab request comes in or an existing one is updated.
    """
    # Create a complete message with lab request details
    message = {
        "type": event_type,
        "lab_request_id": str(lab_request_id) if lab_request_id else None,  # Convert UUID to string
        "timestamp": datetime.now().isoformat(),
        "debug_info": "broadcast_message_v2"  # Add debug info to identify this version
    }
    
    # Add the provided data to the message after ensuring UUIDs are converted to strings
    if data:
        # Helper function to recursively convert UUIDs to strings in nested dictionaries
        def convert_uuids_to_strings(obj):
            if isinstance(obj, dict):
                return {k: convert_uuids_to_strings(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_uuids_to_strings(item) for item in obj]
            elif isinstance(obj, uuid.UUID):
                return str(obj)
            else:
                return obj
                
        # Convert any UUIDs in data to strings
        data = convert_uuids_to_strings(data)
        message.update(data)
    
    # Log the broadcast attempt
    logger.info(f"Broadcasting message about lab request {lab_request_id} to all connected clients")
    
    # Send to all connected clients (without filtering by role)
    disconnected_clients = []
    
    # Loop through all connected clients
    for client_id, websocket in active_connections.items():
        try:
            await websocket.send_json(message)
            logger.info(f"Message sent to client: {client_id}")
        except Exception as e:
            logger.error(f"Failed to send message to client {client_id}: {str(e)}")
            disconnected_clients.append(client_id)
    
    # Clean up disconnected clients
    for client_id in disconnected_clients:
        if client_id in active_connections:
            del active_connections[client_id]

async def receive_messages(websocket: WebSocket, user_id: str):
    """Receive messages from WebSocket client"""
    while True:
        try:
            data = await websocket.receive_json()
            # Process messages from client (e.g., mark notification as read)
            if data.get("type") == "mark_read" and "notification_id" in data.get("data", {}):
                # This would be handled by your notification system
                pass
        except WebSocketDisconnect:
            break
        except Exception as e:
            logger.error(f"Error receiving WebSocket message: {str(e)}")
            break

async def send_messages(websocket: WebSocket, user_id: str):
    """Send queued messages to WebSocket client"""
    queue = message_queues[user_id]
    
    while True:
        try:
            # Wait for new message in queue
            message = await queue.get()
            
            # Send message to client
            await websocket.send_json(message)
            
            # Mark task as done
            queue.task_done()
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {str(e)}")
            break
# doctor_service/app/routes/lab_requests_ws.py (modify existing file)
import uuid
import json
import asyncio
from datetime import datetime
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, Path
from ..websocket import manager
from ..models import LabRequest
from ..schemas import LabResultNotification
from ..dependencies import get_db_pool

router = APIRouter(prefix="/ws", tags=["WebSockets"])
logger = logging.getLogger(__name__)

# Keep existing lab_results_websocket function

# Add a new WebSocket endpoint for lab requests
@router.websocket("/lab-requests/{doctor_id}")
async def lab_requests_websocket(
    websocket: WebSocket,
    doctor_id: str,
    token: Optional[str] = Query(None)
):
    """WebSocket endpoint for sending real-time lab requests to labroom_service."""
    connection_id = await manager.connect(websocket, doctor_id)
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to lab requests WebSocket",
            "doctor_id": doctor_id
        })
        
        # Keep the connection alive
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                if message_type == "new_lab_request":
                    lab_request_data = message.get("data", {})
                    
                    # Log event with full details
                    request_id = lab_request_data.get("id")
                    from app.utils.event_logger import log_lab_request_event
                    await log_lab_request_event(
                        lab_request_id=request_id,
                        event_type="received_via_websocket",
                        details=lab_request_data,
                        user_id=lab_request_data.get("doctor_id")
                    )
                
                elif message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    
            except json.JSONDecodeError:
                # Handle invalid JSON
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message format"
                })
                
    except WebSocketDisconnect:
        # Clean up the connection when the client disconnects
        manager.disconnect(connection_id)
        logger.info(f"WebSocket connection for doctor {doctor_id} closed")
    except Exception as e:
        # Handle any other errors
        logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(connection_id)
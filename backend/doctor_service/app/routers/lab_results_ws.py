# doctor_service/app/routes/lab_results_ws.py
import uuid
import json
import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, Path
from ..websocket import manager
from ..models import LabRequest
from ..schemas import LabResultNotification
from ..dependencies import get_db_pool

router = APIRouter(prefix="/ws", tags=["WebSockets"])

@router.websocket("/lab-results/{doctor_id}")
async def lab_results_websocket(
    websocket: WebSocket,
    doctor_id: str,
    token: Optional[str] = Query(None)
):
    """WebSocket endpoint for receiving real-time lab results."""
    connection_id = await manager.connect(websocket, doctor_id)
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to lab results WebSocket",
            "doctor_id": doctor_id
        })
        
        # Keep the connection alive and handle any incoming messages
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # Handle client messages if needed
                message_type = message.get("type")
                
                if message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message_type == "acknowledge_result":
                    # Handle result acknowledgment if needed
                    result_id = message.get("result_id")
                    if result_id:
                        # Logic to mark result as acknowledged
                        await websocket.send_json({
                            "type": "acknowledge_success",
                            "result_id": result_id
                        })
            except json.JSONDecodeError:
                # Handle invalid JSON
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message format"
                })
    except WebSocketDisconnect:
        # Clean up the connection when the client disconnects
        manager.disconnect(connection_id)
    except Exception as e:
        # Handle any other errors
        manager.disconnect(connection_id)
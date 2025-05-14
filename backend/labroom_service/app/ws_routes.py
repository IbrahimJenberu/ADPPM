# labroom_service/app/ws_routes.py
import uuid
import json
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from datetime import datetime

logger = logging.getLogger(__name__)

# Dictionary to track active connections
active_connections = {}

# labroom_service/app/ws_routes.py
async def lab_requests_websocket(
    websocket: WebSocket,
    doctor_id: str
):
    """WebSocket endpoint for receiving lab requests in real-time."""
    await websocket.accept()
    
    try:
        # Store connection
        active_connections[doctor_id] = websocket
        
        # Send initial connection message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to lab requests WebSocket",
            "doctor_id": doctor_id
        })
        
        logger.info(f"Client connected with ID: {doctor_id}")
        
        # Keep the connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                if message_type == "new_lab_request":
                    lab_request_data = message.get("data", {})
                    
                    # Enhanced logging with full request details
                    request_id = lab_request_data.get("id")
                    logger.info(f"Received lab request via WebSocket with ID: {request_id}")
                    logger.info(f"Request details: "
                            f"Patient: {lab_request_data.get('patient_id')} | "
                            f"Doctor: {lab_request_data.get('doctor_id')} | "
                            f"Test: {lab_request_data.get('test_type')} | "
                            f"Priority: {lab_request_data.get('priority')}")
                    
                    # IMPORTANT: Send immediate acknowledgment BEFORE processing
                    # This prevents the timeout on the doctor_service side
                    await websocket.send_json({
                        "type": "lab_request_received",
                        "request_id": request_id,
                        "success": True,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # Process the request after acknowledgment
                    try:
                        from app.routers.websocket_routes import process_incoming_lab_request
                        result = await process_incoming_lab_request(lab_request_data)
                        logger.info(f"Successfully processed lab request: {request_id}")
                    except Exception as e:
                        logger.error(f"Error processing lab request: {str(e)}")
                        # Send error notification, but don't wait for it to complete
                        try:
                            await websocket.send_json({
                                "type": "lab_request_error",
                                "request_id": request_id,
                                "error": str(e),
                                "timestamp": datetime.now().isoformat()
                            })
                        except:
                            pass
                    
                elif message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                
            except json.JSONDecodeError:
                logger.warning("Received invalid JSON")
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message format"
                })
                
    except WebSocketDisconnect:
        if doctor_id in active_connections:
            del active_connections[doctor_id]
        logger.info(f"Client disconnected: {doctor_id}")
        
    except Exception as e:
        if doctor_id in active_connections:
            del active_connections[doctor_id]
        logger.error(f"WebSocket error: {str(e)}")
        
# Add this to your ws_routes.py file
async def debug_broadcast_lab_request(request_id):
    """Debug function to broadcast a test lab request to all clients."""
    from app.websocket import broadcast_lab_request
    
    test_lab_request = {
        "id": request_id,
        "patient_id": "test-patient-id",
        "patient_name": "Test Patient",
        "doctor_id": "test-doctor-id",
        "doctor_name": "Test Doctor",
        "test_type": "complete_blood_count",
        "priority": "high",
        "status": "pending",
        "notes": "This is a test lab request",
        "created_at": datetime.now().isoformat(),
        "is_read": False
    }
    
    await broadcast_lab_request(
        request_id,
        "new_lab_request",
        {"lab_request": test_lab_request}
    )
    
    logger.info(f"Debug: Sent test lab request with ID {request_id} to all connected clients")
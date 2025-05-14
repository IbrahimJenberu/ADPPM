# labroom_service/app/routes/lab_requests_ws.py
import uuid
import json
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Header, status
from datetime import datetime
from ..database import get_connection, insert, fetch_one
from ..models import TestStatus, TestPriority, TestType
from ..websocket import broadcast_lab_request
from ..exceptions import BadRequestException
from ..config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# This function will be registered directly in main.py
async def lab_requests_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """WebSocket endpoint for receiving real-time lab requests from doctor_service."""
    # Extract token from Authorization header if not in query
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    
    # Validate the token - very basic validation here; you might want more
    if not token or token != settings.SERVICE_TOKEN:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        logger.warning(f"WebSocket connection rejected: Invalid token")
        return
    
    await websocket.accept()
    
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to lab requests WebSocket",
            "timestamp": datetime.now().isoformat()
        })
        
        logger.info("WebSocket connection established for lab requests")
        
        # Listen for incoming lab requests
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                if message_type == "new_lab_request":
                    # Process the incoming lab request
                    lab_request_data = message.get("data", {})
                    result = await process_incoming_lab_request(lab_request_data)
                    
                    # Send acknowledgment
                    await websocket.send_json({
                        "type": "lab_request_received",
                        "request_id": result.get("id"),
                        "success": True,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                elif message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message format"
                })
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {str(e)}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error processing request: {str(e)}"
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")

async def process_incoming_lab_request(lab_request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process an incoming lab request received via WebSocket."""
    logger.info(f"Processing incoming lab request: {lab_request_data}")
    conn = await get_connection()
    
    try:
        # Extract essential fields from the incoming data
        priority = lab_request_data.get("urgency", lab_request_data.get("priority", "medium"))
        
        # Parse datetime strings to datetime objects
        created_at = None
        if "created_at" in lab_request_data:
            try:
                if isinstance(lab_request_data["created_at"], str):
                    created_at = datetime.fromisoformat(lab_request_data["created_at"].replace('Z', '+00:00'))
                else:
                    created_at = lab_request_data["created_at"]
            except (ValueError, TypeError):
                created_at = datetime.now()
        else:
            created_at = datetime.now()
            
        # Create the data dictionary with proper datetime objects
        request_data = {
            "patient_id": lab_request_data.get("patient_id"),
            "doctor_id": lab_request_data.get("doctor_id"),
            "test_type": lab_request_data.get("test_type"),
            "priority": priority,
            "status": lab_request_data.get("status", "pending"),
            "notes": lab_request_data.get("notes"),
            "diagnosis_notes": lab_request_data.get("diagnosis_notes", ""),
            "created_at": created_at,
            "updated_at": datetime.now(),
            "is_deleted": False,
            "is_read": False  # New requests are unread by default
        }
        
        # If the ID is provided, use it, otherwise generate a new one
        lab_request_id = lab_request_data.get("id")
        
        if lab_request_id:
            # Check if this request already exists
            check_query = "SELECT id FROM lab_requests WHERE id = $1"
            existing = await fetch_one(check_query, lab_request_id, conn=conn)
            
            if existing:
                # Request already exists, update it instead
                update_fields = []
                params = [lab_request_id]
                param_index = 2
                
                for key, value in request_data.items():
                    if value is not None:
                        update_fields.append(f"{key} = ${param_index}")
                        params.append(value)
                        param_index += 1
                
                if update_fields:
                    update_query = f"""
                    UPDATE lab_requests 
                    SET {', '.join(update_fields)}, updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                    """
                    
                    result = await conn.fetchrow(update_query, *params)
                    logger.info(f"Updated existing lab request with ID {lab_request_id}")
                    response = dict(result)
            else:
                # Insert with the provided ID
                request_data["id"] = lab_request_id
                
                columns = ", ".join(request_data.keys())
                placeholders = ", ".join(f"${i+1}" for i in range(len(request_data)))
                
                query = f"""
                INSERT INTO lab_requests ({columns})
                VALUES ({placeholders})
                RETURNING *
                """
                
                result = await conn.fetchrow(query, *request_data.values())
                response = dict(result)
                logger.info(f"Created lab request with provided ID {lab_request_id}")
        else:
            # Generate a new ID
            request_data["id"] = str(uuid.uuid4())
            
            columns = ", ".join(request_data.keys())
            placeholders = ", ".join(f"${i+1}" for i in range(len(request_data)))
            
            query = f"""
            INSERT INTO lab_requests ({columns})
            VALUES ({placeholders})
            RETURNING *
            """
            
            result = await conn.fetchrow(query, *request_data.values())
            response = dict(result)
            logger.info(f"Created lab request with new ID {response['id']}")
        
        # Broadcast to lab technicians via WebSocket
        try:
            patient_name = lab_request_data.get("patient_name", "a patient")
            doctor_name = lab_request_data.get("doctor_name", "a doctor")
            
            await broadcast_lab_request(
                str(response["id"]), 
                "new_lab_request", 
                {
                    "lab_request": {
                        "id": str(response["id"]),
                        "test_type": response["test_type"],
                        "priority": response["priority"],
                        "patient_name": patient_name,
                        "doctor_name": doctor_name,
                        "created_at": datetime.now().isoformat()
                    }
                }
            )
        except Exception as e:
            logger.error(f"Error broadcasting lab request: {str(e)}")
        
        return response
        
    finally:
        await conn.close()
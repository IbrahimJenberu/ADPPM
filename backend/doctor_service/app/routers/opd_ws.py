# doctor_service/app/routers/opd_ws.py
import asyncio
import json
import logging
import uuid
from typing import Dict, Set, List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
import httpx

from app.dependencies import get_db_pool
from app.config import settings
from app.services.cardroom_service import get_patient_details

# Setup logger
logger = logging.getLogger(__name__)

router = APIRouter()

# OPD WebSocket connection manager
class OPDConnectionManager:
    def __init__(self):
        # Map of doctor_id -> set of active websocket connections
        self.doctor_connections: Dict[str, Set[WebSocket]] = {}
        # Map of websocket -> doctor_id for reverse lookup
        self.connection_map: Dict[WebSocket, str] = {}
        # Message delivery tracking: message_id -> set of doctor_ids who received it
        self.delivered_messages: Dict[str, Set[str]] = {}
        # Last message cache for each doctor: doctor_id -> list of last 20 messages
        self.message_cache: Dict[str, List[Dict[str, Any]]] = {}
        # Maximum cache size per doctor
        self.max_cache_size = 20
        
    async def connect(self, websocket: WebSocket, doctor_id: str) -> None:
        """Accept connection and register a doctor's WebSocket connection"""
        await websocket.accept()
        
        # Initialize doctor's connections if not exist
        if doctor_id not in self.doctor_connections:
            self.doctor_connections[doctor_id] = set()
            self.message_cache[doctor_id] = []
            
        # Add the connection
        self.doctor_connections[doctor_id].add(websocket)
        self.connection_map[websocket] = doctor_id
        
        connection_count = len(self.doctor_connections[doctor_id])
        logger.info(f"Doctor {doctor_id} connected. Total connections: {connection_count}")
        
        # Send connection confirmation
        await websocket.send_json({
            "event": "connection_established",
            "doctor_id": doctor_id,
            "timestamp": datetime.now().isoformat(),
            "active_connections": connection_count
        })
        
        # Send cached messages to newly connected client
        if doctor_id in self.message_cache and self.message_cache[doctor_id]:
            for cached_msg in self.message_cache[doctor_id]:
                try:
                    await websocket.send_json(cached_msg)
                except Exception as e:
                    logger.error(f"Error sending cached message: {str(e)}")
            
    async def disconnect(self, websocket: WebSocket) -> None:
        """Disconnect and remove a WebSocket connection"""
        if websocket not in self.connection_map:
            return
            
        doctor_id = self.connection_map[websocket]
        
        # Remove from doctor's connections
        if doctor_id in self.doctor_connections:
            self.doctor_connections[doctor_id].discard(websocket)
            
            # If no more connections for this doctor, clean up
            if not self.doctor_connections[doctor_id]:
                del self.doctor_connections[doctor_id]
                logger.info(f"Doctor {doctor_id} fully disconnected")
            else:
                logger.info(f"Doctor {doctor_id} disconnected one session. Remaining: {len(self.doctor_connections[doctor_id])}")
                
        # Remove from connection map
        del self.connection_map[websocket]
    
    async def broadcast_to_doctor(
        self, 
        doctor_id: str, 
        message: Dict[str, Any],
        message_id: Optional[str] = None
    ) -> bool:
        """
        Send a message to all WebSocket connections for a specific doctor.
        Returns True if delivered to at least one connection.
        """
        delivered = False
        
        # Generate message_id if not provided
        if not message_id:
            message_id = str(uuid.uuid4())
            
        # Add message_id to the message
        message["message_id"] = message_id
        
        # Check if this doctor has already received this message
        if (message_id in self.delivered_messages and 
            doctor_id in self.delivered_messages[message_id]):
            logger.debug(f"Message {message_id} already delivered to doctor {doctor_id}")
            return True
        
        # Get connections for this doctor
        connections = []
        if doctor_id in self.doctor_connections:
            connections = list(self.doctor_connections[doctor_id])
        
        if not connections:
            logger.debug(f"No active connections for doctor {doctor_id}")
            # Still cache the message even if no active connections
            await self._cache_message(doctor_id, message)
            return False
        
        # Try to deliver to all connections
        failed_connections = []
        for websocket in connections:
            try:
                await websocket.send_json(message)
                delivered = True
            except Exception as e:
                logger.error(f"Failed to send to a connection for doctor {doctor_id}: {str(e)}")
                failed_connections.append(websocket)
        
        # Clean up failed connections
        for failed in failed_connections:
            await self.disconnect(failed)
        
        # Mark as delivered and cache the message
        if delivered:
            if message_id not in self.delivered_messages:
                self.delivered_messages[message_id] = set()
            self.delivered_messages[message_id].add(doctor_id)
            
            # Cache message
            await self._cache_message(doctor_id, message)
        
        return delivered
    
    async def _cache_message(self, doctor_id: str, message: Dict[str, Any]) -> None:
        """Cache a message for a doctor for later retrieval by new connections"""
        if doctor_id not in self.message_cache:
            self.message_cache[doctor_id] = []
        
        # Add to cache
        self.message_cache[doctor_id].append(message)
        
        # Trim cache if too large
        if len(self.message_cache[doctor_id]) > self.max_cache_size:
            self.message_cache[doctor_id] = self.message_cache[doctor_id][-self.max_cache_size:]

# Create global manager
opd_manager = OPDConnectionManager()

@router.websocket("/ws/opd/{doctor_id}")
async def opd_websocket_endpoint(
    websocket: WebSocket, 
    doctor_id: str,
    pool = Depends(get_db_pool)
):
    """WebSocket endpoint for OPD assignments to doctors"""
    try:
        # Validate doctor_id is a valid UUID
        try:
            doctor_uuid = uuid.UUID(doctor_id)
        except ValueError:
            await websocket.close(code=4000, reason="Invalid doctor ID")
            return
        
        # Connect to the WebSocket
        await opd_manager.connect(websocket, doctor_id)
        
        # Main message loop - keep connection alive and handle incoming messages
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            
            # Process client messages (acknowledgments, etc.)
            try:
                message = json.loads(data)
                
                # Handle message acknowledgment
                if message.get("event") == "ack" and "message_id" in message:
                    logger.debug(f"Received ack for message {message['message_id']} from doctor {doctor_id}")
                    # Could implement more sophisticated acknowledgment handling here
                
                # Handle ping messages to keep connection alive
                elif message.get("event") == "ping":
                    await websocket.send_json({
                        "event": "pong",
                        "timestamp": datetime.now().isoformat()
                    })
                    
            except json.JSONDecodeError:
                logger.warning(f"Received invalid JSON from doctor {doctor_id}")
                
    except WebSocketDisconnect:
        # WebSocket disconnect from the client
        await opd_manager.disconnect(websocket)
        
    except Exception as e:
        # Handle other exceptions
        logger.error(f"WebSocket error for doctor {doctor_id}: {str(e)}", exc_info=True)
        await opd_manager.disconnect(websocket)
        
async def broadcast_patient_assignment(
    doctor_id: str, 
    patient_id: str, 
    assignment_id: str,
    assignment_data: Dict[str, Any],
    pool
) -> bool:
    """
    Broadcast a patient assignment to a doctor via WebSocket.
    Returns True if the message was delivered.
    """
    try:
        # Convert IDs to string if they're UUIDs
        doctor_id_str = str(doctor_id)
        patient_id_str = str(patient_id)
        assignment_id_str = str(assignment_id) if assignment_id else None
        
        # If we have patient data already in the assignment_data, use it
        patient_data = assignment_data.get("patient", {})
        
        # If we don't have complete patient data but we have patient_id, try to get it
        if patient_id_str and (not patient_data or not patient_data.get("id")):
            try:
                patient_details = await get_patient_details(uuid.UUID(patient_id_str), pool)
                if patient_details:
                    patient_data = {
                        "id": patient_id_str,
                        "registration_number": patient_details.get("registration_number"),
                        "first_name": patient_details.get("first_name"),
                        "last_name": patient_details.get("last_name"),
                        "name": f"{patient_details.get('first_name', '')} {patient_details.get('last_name', '')}".strip(),
                        "date_of_birth": patient_details.get("date_of_birth"),
                        "gender": patient_details.get("gender"),
                        "blood_group": patient_details.get("blood_group"),
                        "phone_number": patient_details.get("phone_number"),
                        "email": patient_details.get("email"),
                        "address": patient_details.get("address"),
                        "allergies": patient_details.get("allergies", []),
                        "medical_history": patient_details.get("medical_history", {})
                    }
            except Exception as e:
                logger.warning(f"Could not get patient details: {str(e)}")
        
        # Create complete message with full patient details
        message = {
            "event": "patient_assigned",
            "timestamp": datetime.now().isoformat(),
            "assignment_id": assignment_id_str,
            "data": {
                "patient_id": patient_id_str,
                "assignment_id": assignment_id_str,
                "title": assignment_data.get("title", "New Patient Assigned"),
                "message": assignment_data.get("message", "You have a new patient assigned"),
                "priority": assignment_data.get("priority", "NORMAL"),
                "status": assignment_data.get("status", "PENDING"),
                "notes": assignment_data.get("notes"),
                "patient": patient_data  # Include complete patient data
            }
        }
        
        # Generate a unique message ID for this assignment
        message_id = f"assignment_{assignment_id_str}" if assignment_id_str else str(uuid.uuid4())
        
        # Broadcast to doctor
        return await opd_manager.broadcast_to_doctor(doctor_id_str, message, message_id)
        
    except Exception as e:
        logger.error(f"Error broadcasting patient assignment: {str(e)}", exc_info=True)
        return False
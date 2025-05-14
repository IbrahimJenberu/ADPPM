# doctor_service/app/utils/opd_ws_client.py
import asyncio
import json
import logging
import websockets
import uuid
import random
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from app.config import settings
from app.routers.opd_ws import broadcast_patient_assignment
from app.database import get_app_pool

# Setup logger
logger = logging.getLogger(__name__)

# Constants
INITIAL_RECONNECT_DELAY = 1.0  # seconds
MAX_RECONNECT_DELAY = 60.0     # seconds
RECONNECT_BACKOFF_FACTOR = 1.5
JITTER_FACTOR = 0.2            # Add randomness to reconnection times

# Global WebSocket connection state
opd_ws_connection = None
opd_ws_task = None
last_connection_attempt = None

async def connect_to_cardroom_ws():
    """
    Connect to cardroom service WebSocket endpoint.
    Uses exponential backoff for reconnection attempts.
    """
    global opd_ws_connection, last_connection_attempt
    
    # Track connection attempts for backoff
    reconnect_delay = INITIAL_RECONNECT_DELAY
    attempt_count = 0
    
    while True:
        try:
            # Update last attempt time
            last_connection_attempt = datetime.now()
            attempt_count += 1
            
            # Construct WebSocket URL with service token authentication
            cardroom_ws_url = f"{settings.CARDROOM_SERVICE_WS_URL}/ws/doctor-assignments"
            if "http" in cardroom_ws_url:
                # Convert HTTP to WebSocket protocol
                cardroom_ws_url = cardroom_ws_url.replace("http://", "ws://").replace("https://", "wss://")
            
            # Add auth token
            cardroom_ws_url = f"{cardroom_ws_url}?token={settings.SERVICE_TOKEN}"
            
            logger.info(f"Connecting to cardroom WebSocket: {cardroom_ws_url}")
            
            # Connect with timeout
            async with websockets.connect(
                cardroom_ws_url,
                ping_interval=30,  # Send ping every 30 seconds
                ping_timeout=10,   # Wait 10 seconds for pong response
                close_timeout=5,   # Wait 5 seconds for close handshake
                max_size=10_485_760,  # 10MB max message size
                extra_headers={"X-Service-Name": "doctor_service"}
            ) as websocket:
                # Reset reconnect delay on successful connection
                reconnect_delay = INITIAL_RECONNECT_DELAY
                attempt_count = 0
                opd_ws_connection = websocket
                
                logger.info("Connected to cardroom WebSocket")
                
                # Send initial authentication message
                await websocket.send(json.dumps({
                    "type": "authenticate",
                    "service": "doctor_service",
                    "timestamp": datetime.now().isoformat()
                }))
                
                # Main message processing loop
                while True:
                    try:
                        # Receive messages with timeout
                        message = await asyncio.wait_for(websocket.recv(), timeout=120)
                        
                        # Process the message
                        await process_cardroom_message(message)
                    except asyncio.TimeoutError:
                        # Send heartbeat message to keep connection alive
                        await websocket.send(json.dumps({
                            "type": "heartbeat",
                            "timestamp": datetime.now().isoformat()
                        }))
                    except websockets.exceptions.ConnectionClosed as e:
                        logger.warning(f"Cardroom WebSocket connection closed: {e}")
                        break
                    except Exception as e:
                        logger.error(f"Error processing WebSocket message: {str(e)}", exc_info=True)
                        # Don't break the loop for processing errors, continue receiving
                
        except (websockets.exceptions.WebSocketException, ConnectionRefusedError, OSError) as e:
            logger.error(f"WebSocket connection error (attempt {attempt_count}): {str(e)}")
            
            # Calculate backoff with jitter
            jitter = random.uniform(-JITTER_FACTOR, JITTER_FACTOR)
            adjusted_delay = reconnect_delay * (1 + jitter)
            
            logger.info(f"Reconnecting in {adjusted_delay:.2f} seconds...")
            await asyncio.sleep(adjusted_delay)
            
            # Increase backoff for next attempt
            reconnect_delay = min(reconnect_delay * RECONNECT_BACKOFF_FACTOR, MAX_RECONNECT_DELAY)
        except Exception as e:
            logger.exception(f"Unexpected error in WebSocket connection: {str(e)}")
            await asyncio.sleep(reconnect_delay)
            
        finally:
            opd_ws_connection = None

async def process_cardroom_message(message_data: str) -> None:
    """Process incoming WebSocket messages from cardroom service"""
    try:
        # Parse the message
        message = json.loads(message_data)
        message_type = message.get("type")
        
        logger.debug(f"Received message type: {message_type}")
        
        # Get application pool for database operations
        pool = await get_app_pool()
        
        if message_type == "patient_assignment":
            # Process new patient assignment
            doctor_id = message.get("doctor_id")
            patient_id = message.get("patient_id")
            assignment_id = message.get("assignment_id")
            assignment_data = message.get("data", {})
            
            if not all([doctor_id, patient_id, assignment_id]):
                logger.error(f"Invalid patient assignment message: {message}")
                return
                
            logger.info(f"Processing patient assignment: {assignment_id} - Patient {patient_id} to Doctor {doctor_id}")
            
            # Broadcast to connected doctor
            delivered = await broadcast_patient_assignment(
                doctor_id, 
                patient_id, 
                assignment_id, 
                assignment_data,
                pool
            )
            
            # Log delivery status
            if delivered:
                logger.info(f"Assignment {assignment_id} delivered to doctor {doctor_id}")
            else:
                logger.warning(f"Assignment {assignment_id} not delivered to doctor {doctor_id} (offline)")
                # Save for later delivery
            
            # Send delivery acknowledgment
            if opd_ws_connection:
                await opd_ws_connection.send(json.dumps({
                    "type": "assignment_ack",
                    "assignment_id": assignment_id,
                    "doctor_id": doctor_id,
                    "timestamp": datetime.now().isoformat(),
                    "status": "delivered" if delivered else "pending",
                    "message_id": str(uuid.uuid4())
                }))
            
        elif message_type == "heartbeat":
            # Respond to heartbeat
            if opd_ws_connection:
                await opd_ws_connection.send(json.dumps({
                    "type": "heartbeat_ack",
                    "timestamp": datetime.now().isoformat()
                }))
                
        elif message_type == "assignment_status_update":
            # Handle status updates for assignments
            assignment_id = message.get("assignment_id")
            new_status = message.get("status")
            doctor_id = message.get("doctor_id")
            
            logger.info(f"Assignment {assignment_id} status changed to {new_status}")
            
            # You could broadcast these updates to the doctor as well
            # if they need to see status changes made elsewhere
        
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in WebSocket message: {message_data}")
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}", exc_info=True)

async def start_cardroom_ws_client():
    """Start the WebSocket client as a background task"""
    global opd_ws_task
    
    if opd_ws_task is None or opd_ws_task.done():
        opd_ws_task = asyncio.create_task(connect_to_cardroom_ws())
        logger.info("Started cardroom WebSocket client task")
    else:
        logger.info("Cardroom WebSocket client task already running")
import asyncio
import json
import logging
import uuid
from typing import Dict, Any, Optional
import websockets
from datetime import datetime
from ..config import settings

logger = logging.getLogger(__name__)

# Global variables to manage the WebSocket connection
ws_connection = None
connection_task = None
reconnect_interval = 5  # seconds
last_connection_attempt = 0
connected = False
doctor_id = None  # Will be set by set_doctor_id

# doctor_service/app/utils/lab_request_ws_client.py
async def get_ws_connection():
    """Get or establish a WebSocket connection to the lab service."""
    global ws_connection, connection_task, connected, last_connection_attempt, doctor_id
    
    # Don't retry connections too frequently
    current_time = asyncio.get_event_loop().time()
    if not connected and (current_time - last_connection_attempt < reconnect_interval):
        return None
    
    # Return existing connection if valid
    if ws_connection is not None and connected:
        try:
            # Send a ping to verify connection is still alive
            await ws_connection.send(json.dumps({"type": "ping"}))
            return ws_connection
        except Exception:
            # Connection is dead, reset and try again
            connected = False
            ws_connection = None
    
    # Ensure we have a doctor_id to connect with
    if not doctor_id:
        logger.error("No doctor_id set for WebSocket connection")
        return None
    
    try:
        last_connection_attempt = current_time
        lab_service_url = settings.LAB_SERVICE_URL
        ws_url = f"{lab_service_url.replace('http://', 'ws://')}/ws/lab-requests/{doctor_id}"
        
        logger.info(f"Establishing WebSocket connection to {ws_url}")
        
        # Use simpler connection with ping_interval to keep connection alive
        ws_connection = await websockets.connect(ws_url, ping_interval=30, close_timeout=10)
        
        # Receive initial connection message
        try:
            initial_msg = await asyncio.wait_for(ws_connection.recv(), timeout=5.0)
            initial_data = json.loads(initial_msg)
            
            if initial_data.get("type") == "connection_established":
                connected = True
                logger.info("WebSocket connection established with lab service")
                
                # Start background task to keep connection alive
                if connection_task is None or connection_task.done():
                    connection_task = asyncio.create_task(keep_alive_ping())
                
                return ws_connection
            else:
                logger.warning(f"Unexpected initial message: {initial_data}")
                await ws_connection.close()
                ws_connection = None
                connected = False
                return None
        except asyncio.TimeoutError:
            logger.error("Timeout waiting for connection confirmation")
            await ws_connection.close()
            ws_connection = None
            connected = False
            return None
                
    except Exception as e:
        logger.error(f"Failed to establish WebSocket connection: {str(e)}")
        if ws_connection:
            try:
                await ws_connection.close()
            except:
                pass
        ws_connection = None
        connected = False
        return None

async def keep_alive_ping():
    """Send periodic pings to keep the WebSocket connection alive."""
    global ws_connection, connected
    
    try:
        while ws_connection and connected:
            try:
                await asyncio.sleep(30)
                if ws_connection and connected:
                    await ws_connection.send(json.dumps({"type": "ping"}))
                    logger.debug("Ping sent to keep connection alive")
            except Exception as e:
                logger.error(f"Ping failed, connection may be closed: {str(e)}")
                connected = False
                break
    except asyncio.CancelledError:
        pass

# doctor_service/app/utils/lab_request_ws_client.py

# doctor_service/app/utils/lab_request_ws_client.py
async def send_lab_request_via_ws(lab_request: Dict[str, Any]) -> bool:
    """
    Send a lab request to the lab service via WebSocket.
    
    Returns:
        bool: True if the request was sent successfully, False otherwise
    """
    global connected
    
    websocket = await get_ws_connection()
    if not websocket or not connected:
        logger.warning("No active WebSocket connection available to send lab request")
        return False
    
    try:
        # Prepare the message
        message = {
            "type": "new_lab_request",
            "data": lab_request,
            "timestamp": datetime.now().isoformat()
        }
        
        # Send the message
        await websocket.send(json.dumps(message))
        
        # Wait for acknowledgment (with timeout)
        try:
            # Reduced timeout to avoid long waits
            response_task = asyncio.create_task(websocket.recv())
            response_text = await asyncio.wait_for(response_task, timeout=5.0)
            response = json.loads(response_text)
            
            # Handle different response types
            if response.get("type") == "pong":
                # This is just a keep-alive response, wait for the actual acknowledgment
                response_task = asyncio.create_task(websocket.recv())
                response_text = await asyncio.wait_for(response_task, timeout=5.0)
                response = json.loads(response_text)
            
            if response.get("type") == "lab_request_received" and response.get("success"):
                logger.info(f"Lab request {lab_request.get('id')} successfully sent via WebSocket")
                return True
            else:
                logger.warning(f"Lab request not acknowledged properly: {response}")
                return False
                
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for lab request acknowledgment")
            connected = False  # Mark connection as failed
            return False
            
    except Exception as e:
        logger.error(f"Error sending lab request via WebSocket: {str(e)}")
        connected = False  # Mark connection as failed
        return False

def set_doctor_id(new_doctor_id: str):
    """Update the doctor ID for WebSocket connections"""
    global doctor_id, ws_connection, connected
    
    # If the doctor ID is changing, close the existing connection
    if doctor_id != new_doctor_id and ws_connection and connected:
        asyncio.create_task(ws_connection.close())
        ws_connection = None
        connected = False
    
    doctor_id = new_doctor_id
    logger.info(f"WebSocket doctor ID updated to {doctor_id}")
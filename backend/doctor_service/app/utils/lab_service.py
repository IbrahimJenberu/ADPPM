import httpx
from typing import Dict, Any, Optional
import uuid
import asyncio
import logging
from datetime import datetime
from app.config import settings
from .lab_request_ws_client import send_lab_request_via_ws

logger = logging.getLogger(__name__)

async def send_notification_to_lab_tech(
    lab_tech_id: uuid.UUID,
    sender_id: uuid.UUID,
    message: str,
    notification_type: str,
    lab_request_id: Optional[uuid.UUID] = None,
    additional_data: Optional[Dict[str, Any]] = None
) -> bool:
    """Send a notification to a lab technician through the lab service API."""
    try:
        lab_service_url = settings.LAB_SERVICE_URL
        notification_endpoint = f"{lab_service_url}/api/inter-service/notifications"
        
        # Prepare notification data
        notification_data = {
            "recipient_id": str(lab_tech_id),
            "sender_id": str(sender_id),
            "message": message,
            "notification_type": notification_type,
            "additional_data": additional_data or {}
        }
        
        if lab_request_id:
            notification_data["entity_id"] = str(lab_request_id)
            notification_data["entity_type"] = "lab_request"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                notification_endpoint,
                json=notification_data,
                timeout=10.0
            )
            
            response.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Failed to send notification to lab service: {e}")
        return False

async def process_lab_request(
    lab_request_id: uuid.UUID,
    technician_id: uuid.UUID,
    status: str = "in_progress"
) -> bool:
    """Process a lab request by calling the lab service API."""
    try:
        lab_service_url = settings.LAB_SERVICE_URL
        process_endpoint = f"{lab_service_url}/api/inter-service/lab-requests/{lab_request_id}/process"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                process_endpoint,
                params={
                    "technician_id": str(technician_id),
                    "status": status
                },
                timeout=10.0
            )
            
            response.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Failed to process lab request: {e}")
        return False

logger = logging.getLogger(__name__)

# doctor_service/app/utils/lab_service.py

async def create_lab_request_in_lab_service(lab_request: Dict[str, Any], max_retries: int = 3) -> bool:
    """Create or update a lab request in the lab service with WebSocket and fallback to HTTP."""
    # Set the doctor ID for WebSocket connection if present in the request
    if "doctor_id" in lab_request:
        from .lab_request_ws_client import set_doctor_id
        set_doctor_id(str(lab_request["doctor_id"]))
    
    # First try WebSocket for real-time delivery
    try:
        from .lab_request_ws_client import send_lab_request_via_ws
        ws_success = await send_lab_request_via_ws(lab_request)
        if ws_success:
            logger.info(f"Successfully sent lab request {lab_request.get('id')} via WebSocket")
            return True
    except Exception as e:
        logger.warning(f"WebSocket delivery failed, falling back to HTTP: {str(e)}")
    
    # HTTP fallback - check for duplicate error to avoid it
    lab_service_url = settings.LAB_SERVICE_URL
    create_endpoint = f"{lab_service_url}/api/inter-service/lab-requests"
    
    # Convert UUID fields to strings for JSON serialization
    serialized_request = {}
    for key, value in lab_request.items():
        if isinstance(value, uuid.UUID):
            serialized_request[key] = str(value)
        elif isinstance(value, datetime):
            serialized_request[key] = value.isoformat()
        else:
            serialized_request[key] = value
    
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                logger.info(f"Sending lab request to lab service at {create_endpoint}")
                
                response = await client.post(
                    create_endpoint,
                    json=serialized_request,
                    timeout=30.0
                )
                
                # Handle success case
                if response.status_code == 200 or response.status_code == 201:
                    logger.info(f"Successfully synchronized lab request {serialized_request.get('id')} with lab service via HTTP")
                    return True
                # Handle duplicate key error - if it's already created, consider it a success
                elif response.status_code == 500 and "duplicate key value" in response.text:
                    logger.info(f"Lab request {serialized_request.get('id')} already exists in lab service (created via WebSocket)")
                    return True
                else:
                    logger.error(f"Failed to create lab request in lab service. Status code: {response.status_code}, Response: {response.text}")
                    return False
                    
        except httpx.ConnectError as e:
            retry_count += 1
            wait_time = 2 ** retry_count  # Exponential backoff
            logger.warning(f"Connection error to lab service (attempt {retry_count}/{max_retries}): {str(e)}. Retrying in {wait_time} seconds...")
            
            if retry_count < max_retries:
                await asyncio.sleep(wait_time)
            else:
                logger.error(f"Failed to create lab request in lab service after {max_retries} attempts: {str(e)}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to create lab request in lab service: {str(e)}")
            return False
    
    return False

async def fetch_lab_result(lab_result_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """Fetch a lab result from the lab service."""
    lab_service_url = settings.LAB_SERVICE_URL
    result_endpoint = f"{lab_service_url}/api/inter-service/lab-results/{lab_result_id}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                result_endpoint,
                headers={"Authorization": f"Bearer {settings.SERVICE_TOKEN}"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logging.error(f"Failed to fetch lab result. Status: {response.status_code}, Response: {response.text}")
                return None
    except Exception as e:
        logging.error(f"Error fetching lab result: {str(e)}")
        return None
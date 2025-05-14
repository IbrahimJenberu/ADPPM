# cardroom_service/app/services/doctor_service.py
import httpx
from typing import Dict, Any, Optional
from uuid import UUID
import logging
import json

from app.config import settings
from app.exceptions import ServiceUnavailableException

# Custom JSON encoder to handle UUID serialization
class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)

async def send_notification_to_doctor(
    recipient_id: UUID,
    title: str,
    message: str,
    entity_type: str,
    entity_id: UUID
) -> Dict[str, Any]:
    """Send a notification to a doctor via the doctor service."""
    try:
        notification_data = {
            "recipient_id": str(recipient_id),  # Convert UUID to string
            "title": title,
            "message": message,
            "entity_type": entity_type,
            "entity_id": str(entity_id)  # Convert UUID to string
        }
        
        async with httpx.AsyncClient() as client:
            # Use regular endpoint for standard notifications
            response = await client.post(
                f"{settings.DOCTOR_SERVICE_URL}/notifications/",
                json=notification_data,
                timeout=5.0
            )
            
            if response.status_code not in (200, 201):
                logging.error(f"Error from doctor service: {response.text}")
                raise ServiceUnavailableException("Doctor service error")
            
            # Try to send via WebSocket for real-time updates
            try:
                # Use the same data for WebSocket
                websocket_response = await client.post(
                    f"{settings.DOCTOR_SERVICE_URL}/webhooks/opd-assignments",
                    json=notification_data,
                    timeout=3.0  # Shorter timeout for the optional endpoint
                )
                
                if websocket_response.status_code in (200, 201):
                    logging.info(f"Real-time notification sent to doctor {recipient_id}")
            except Exception as ws_error:
                # Don't fail if the WebSocket notification fails
                logging.warning(f"WebSocket notification failed (non-critical): {str(ws_error)}")
            
            return response.json()
            
    except httpx.RequestError as e:
        logging.error(f"Error connecting to doctor service: {str(e)}")
        # Don't fail the entire operation if notification fails
        # Just log the error and continue
        return {"error": "Failed to send notification"}
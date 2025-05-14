# doctor_service/app/routers/inter_service.py
import uuid
import logging
import json
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request, Path, Query, Header
from pydantic import BaseModel, UUID4, Field
from datetime import datetime
import httpx

from ..schemas import BaseResponse, LabResultNotification
from ..dependencies import get_db_pool
from ..websocket import manager
from ..notifications import create_notification
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/inter-service", tags=["Inter-Service Communication"])

# In doctor_service/app/routers/inter_service.py
async def verify_service_token(authorization: Optional[str] = Header(None)):
    """Verify the service-to-service authentication token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )
        
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme"
        )
        
    if not token or token != settings.SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token"
        )
    
    return True

# Define schema for incoming notifications
class ServiceNotification(BaseModel):
    recipient_id: UUID4
    sender_id: UUID4 = Field(..., description="ID of the sending user/service")
    message: str
    notification_type: str
    entity_id: Optional[UUID4] = Field(None, description="Related entity ID (lab request, result, etc.)")
    entity_type: Optional[str] = Field(None, description="Type of the related entity")
    additional_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    class Config:
        schema_extra = {
            "example": {
                "recipient_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "sender_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", 
                "message": "New lab request created",
                "notification_type": "new_lab_request",
                "entity_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "entity_type": "lab_request",
                "additional_data": {"priority": "urgent", "test_type": "blood"}
            }
        }

@router.post("/notifications", response_model=BaseResponse)
async def receive_service_notification(
    notification: ServiceNotification = Body(...),
    pool = Depends(get_db_pool)
):
    """
    Endpoint for receiving notifications from other services.
    This endpoint is not protected by authentication to allow inter-service communication.
    """
    try:
        # Map notification type from string to enum (if possible)
        # Determine notification parameters based on entity type
        lab_request_id = notification.entity_id if notification.entity_type == "lab_request" else None
        lab_result_id = notification.entity_id if notification.entity_type == "lab_result" else None
        
        # Create notification in the database
        # Convert UUIDs to strings for the notification
        recipient_id = notification.recipient_id
        message = notification.message
        notification_type = notification.notification_type
        entity_id = notification.entity_id

        # Create notification using existing system
        await create_notification(
            pool,
            recipient_id,
            notification.additional_data.get("title", "New Notification"),
            message,
            notification_type,
            str(entity_id) if entity_id else None
        )
            
        return {
            "success": True,
            "message": "Notification received and processed successfully"
        }
            
    except Exception as e:
        logger.error(f"Failed to process notification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process notification: {str(e)}"
        )

@router.post("/lab-results", response_model=BaseResponse)
async def receive_lab_result(
    result_data: Dict[str, Any] = Body(...),
    pool = Depends(get_db_pool)
):
    """
    Endpoint for labroom_service to notify about new lab results.
    This will:
    1. Store the result notification in the database
    2. Send a real-time notification to the doctor via WebSocket
    """
    try:
        # Validate required fields
        for field in ("doctor_id", "lab_request_id", "lab_result_id"):
            if field not in result_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}"
                )

        doctor_id = result_data["doctor_id"]
        if isinstance(doctor_id, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="doctor_id must be a string UUID, not an object"
            )

        lab_request_id = result_data["lab_request_id"]
        lab_result_id = result_data["lab_result_id"]

        # Persist notification in the DB
        await create_notification(
            pool,
            uuid.UUID(doctor_id),
            "Lab Result Ready",
            f"Lab result for test {result_data.get('test_type', 'Unknown')} is now available",
            "lab_result_ready",
            str(lab_request_id)
        )

        # Prepare the WebSocket payload - include complete data from result_data
        ws_message = {
            "type": "lab_result_ready",
            "data": {
                "lab_request_id": lab_request_id,
                "lab_result_id": lab_result_id,
                "test_type": result_data.get("test_type"),
                "conclusion": result_data.get("conclusion"),
                "result_data": result_data.get("result_data"),  # Include the FULL result data
                "result_summary": result_data.get("result_summary"),
                "image_paths": result_data.get("image_paths", []),  # Include images
                "created_at": result_data.get("created_at")
            }
        }

        logger.info(f"Sending WebSocket message to doctor: {doctor_id}")
        await manager.send_personal_message(doctor_id, ws_message)

        return {
            "success": True,
            "message": f"Lab result notification sent to doctor {doctor_id}"
        }

    except ValueError as e:
        # Handle UUID conversion errors
        logger.error(f"Invalid UUID format: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid UUID format: {e}"
        )
    except HTTPException:
        # Re‑raise known HTTP errors unmodified
        raise
    except Exception as e:
        logger.error(f"Error processing lab result notification: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process lab result notification: {e}"
        )


@router.get("/lab-results/by-request/{lab_request_id}", response_model=Dict[str, Any])
async def get_lab_results_by_request_id(
    lab_request_id: uuid.UUID = Path(...),
    pool = Depends(get_db_pool)
):
    """
    Fetch lab results for a specific lab request.
    This endpoint retrieves all lab results associated with a lab request ID.
    """
    try:
        # First, verify the lab request exists
        lab_service_url = settings.LAB_SERVICE_URL
        endpoint = f"{lab_service_url}/api/inter-service/lab-requests/{lab_request_id}/results"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {settings.SERVICE_TOKEN}"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No lab results found for request ID: {lab_request_id}"
                )
            else:
                logger.error(f"Failed to fetch lab results from lab service. Status: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch lab results from lab service"
                )
    except httpx.RequestError as e:
        logger.error(f"Error connecting to lab service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lab service is unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )


@router.get("/lab-results/{result_id}", response_model=Dict[str, Any])
async def get_lab_result_by_id(result_id: uuid.UUID = Path(...)):
    """
    Fetch lab result details from lab service.
    This endpoint queries the lab service for result details.
    """
    try:
        lab_service_url = settings.LAB_SERVICE_URL
        endpoint = f"{lab_service_url}/api/inter-service/lab-results/{result_id}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                endpoint,
                headers={"Authorization": f"Bearer {settings.SERVICE_TOKEN}"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to fetch lab result from lab service. Status: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch lab result from lab service"
                )
    except httpx.RequestError as e:
        logger.error(f"Error connecting to lab service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Lab service is unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )
        
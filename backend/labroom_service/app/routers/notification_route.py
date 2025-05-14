# notification_routes.py
import uuid
import logging
import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request, Path, Query
from pydantic import BaseModel, UUID4, Field
from datetime import datetime
from ..database import get_connection, insert, update, fetch_one
from ..models import NotificationType, TestStatus
from ..notifications import create_notification
from ..schemas import StatusResponse, LabRequestResponse
from ..exceptions import BadRequestException
from ..websocket import broadcast_lab_request
from ..dependencies import get_lab_request

# Create router without authentication dependency
router = APIRouter(prefix="/inter-service", tags=["Inter-Service Communication"])

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

@router.post("/notifications", response_model=StatusResponse)
async def receive_service_notification(
    notification: ServiceNotification = Body(...)
):
    """
    Endpoint for receiving notifications from other services.
    This endpoint is not protected by authentication to allow inter-service communication.
    """
    conn = await get_connection()
    
    try:
        # Map notification type from string to enum (if possible)
        try:
            mapped_type = NotificationType(notification.notification_type)
        except ValueError:
            # If the notification type doesn't match the enum, use it as is
            mapped_type = None
            
        # Determine notification parameters based on entity type
        lab_request_id = notification.entity_id if notification.entity_type == "lab_request" else None
        lab_result_id = notification.entity_id if notification.entity_type == "lab_result" else None
        
        # Create notification in the database
        if mapped_type:
            # Use existing notification system if type is mapped
            await create_notification(
                recipient_id=notification.recipient_id,
                sender_id=notification.sender_id,
                title=notification.additional_data.get("title", "New Notification"),
                message=notification.message,
                notification_type=mapped_type,
                lab_request_id=lab_request_id,
                lab_result_id=lab_result_id,
                send_websocket=True  # Send via WebSocket if user is connected
            )
        else:
            # Fallback to direct DB insert for unmapped types
            notification_data = {
                "recipient_id": str(notification.recipient_id),
                "sender_id": str(notification.sender_id),
                "title": notification.additional_data.get("title", "New Notification"),
                "message": notification.message,
                "notification_type": notification.notification_type,
                "is_read": False
            }
            
            if lab_request_id:
                notification_data["lab_request_id"] = str(lab_request_id)
            
            if lab_result_id:
                notification_data["lab_result_id"] = str(lab_result_id)
                
            await insert("lab_notifications", notification_data, conn=conn)
            
        return StatusResponse(
            status="success",
            message="Notification received and processed successfully"
        )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process notification: {str(e)}"
        )
    finally:
        await conn.close()

# Add a lab request update endpoint for direct processing
@router.post("/lab-requests/{request_id}/process", response_model=StatusResponse)
async def process_lab_request(
    request_id: UUID4,
    technician_id: UUID4,
    status: Optional[str] = "in_progress"
):
    """
    Process a lab request by assigning it to a technician.
    This endpoint is specifically for inter-service communication without authentication.
    """
    conn = await get_connection()
    
    try:
        # Check if the request exists
        check_query = "SELECT * FROM lab_requests WHERE id = $1 AND is_deleted = FALSE"
        lab_request = await fetch_one(check_query, str(request_id), conn=conn)
        
        if not lab_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lab request with ID {request_id} not found"
            )
            
        # Update the lab request
        update_data = {
            "technician_id": str(technician_id),
            "status": status,
            "updated_at": "NOW()"
        }
        
        update_query = """
        UPDATE lab_requests SET
            technician_id = $1,
            status = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING id
        """
        
        result = await conn.fetchval(update_query, str(technician_id), status, str(request_id))
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update lab request"
            )
            
        # Create notification for doctor
        if lab_request.get("doctor_id"):
            try:
                # Get technician name (if available)
                tech_query = "SELECT full_name FROM users WHERE id = $1"
                tech_name = await conn.fetchval(tech_query, str(technician_id))
                
                tech_name = tech_name or "A lab technician"
                
                notification_data = {
                    "recipient_id": lab_request.get("doctor_id"),
                    "sender_id": str(technician_id),
                    "title": "Lab Request Status Update",
                    "message": f"{tech_name} has started processing your lab request",
                    "notification_type": "lab_request_updated",
                    "lab_request_id": str(request_id),
                    "is_read": False
                }
                
                await insert("lab_notifications", notification_data, conn=conn)
            except Exception as e:
                # Log error but continue (non-critical)
                print(f"Error creating notification: {e}")
        
        return StatusResponse(
            status="success",
            message=f"Lab request {request_id} successfully assigned to technician {technician_id}"
        )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process lab request: {str(e)}"
        )
    finally:
        await conn.close()
        

# Update the create_lab_request_from_service function in labroom_service/app/routes/notification_routes.py

@router.post("/lab-requests", response_model=StatusResponse)
async def create_lab_request_from_service(
    lab_request: Dict[str, Any] = Body(...)
):
    """
    Endpoint for creating lab requests from other services.
    This endpoint is not protected by authentication to allow inter-service communication.
    """
    conn = await get_connection()
    
    try:
        # Log the incoming request data
        logging.info(f"Received lab request from doctor service: {lab_request}")
        
        # First check if this lab request already exists
        lab_request_id = lab_request.get("id")
        if lab_request_id:
            check_query = "SELECT id FROM lab_requests WHERE id = $1"
            existing = await conn.fetchval(check_query, lab_request_id)
            
            if existing:
                # Request already exists - return success to avoid errors
                logging.info(f"Lab request {lab_request_id} already exists, skipping creation")
                return StatusResponse(
                    status="success",
                    message=f"Lab request {lab_request_id} already exists"
                )
        
        # Extract essential fields from the incoming data
        priority = lab_request.get("urgency", lab_request.get("priority", "routine"))
        
        # Rest of the existing function...
        # [existing implementation here]

        return StatusResponse(
            status="success",
            message=f"Lab request created successfully with ID: {lab_request_id}"
        )
            
    except Exception as e:
        logging.error(f"Failed to create lab request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create lab request: {str(e)}"
        )
    finally:
        await conn.close()


@router.patch("/{request_id}/mark-read", response_model=LabRequestResponse)
async def mark_lab_request_as_read(
    request_id: uuid.UUID = Path(...),
    labtechnician_id: uuid.UUID = Query(..., description="Lab Technician ID from frontend"),
):
    """
    Mark a lab request as read.
    """
    conn = await get_connection()
    
    try:
        # Get the lab request
        lab_request = await get_lab_request(request_id, labtechnician_id)
        
        # Check if already read
        if lab_request.is_read:
            return LabRequestResponse(**lab_request.to_dict())
        
        # Update to mark as read
        update_data = {
            "is_read": True,
            "read_at": datetime.now()
        }
        
        success = await update("lab_requests", request_id, update_data, conn=conn)
        
        if not success:
            raise BadRequestException("Failed to mark lab request as read")
        
        # Add event to history
        event_data = {
            "lab_request_id": str(request_id),
            "event_type": "read",
            "user_id": str(labtechnician_id),
            "details": json.dumps({
                "action": "marked_as_read",
                "by_user": str(labtechnician_id)
            })
        }
        
        await conn.execute("""
            INSERT INTO lab_request_events 
            (lab_request_id, event_type, user_id, details)
            VALUES ($1, $2, $3, $4)
        """, event_data["lab_request_id"], event_data["event_type"], 
            event_data["user_id"], event_data["details"])
        
        # Get updated request
        query = "SELECT * FROM lab_requests WHERE id = $1"
        updated_row = await fetch_one(query, str(request_id), conn=conn)
        
        # Notify via WebSocket
        try:
            await broadcast_lab_request(
                str(request_id), 
                "lab_request_updated", 
                {"updates": {"is_read": True, "read_at": update_data["read_at"].isoformat()}}
            )
        except Exception as e:
            # Log but don't fail on WebSocket errors
            print(f"WebSocket notification error: {str(e)}")
        
        return LabRequestResponse(**updated_row)
    finally:
        await conn.close()

@router.patch("/{request_id}/mark-unread", response_model=LabRequestResponse)
async def mark_lab_request_as_unread(
    request_id: uuid.UUID = Path(...),
    labtechnician_id: uuid.UUID = Query(..., description="Lab Technician ID from frontend"),
):
    """
    Mark a lab request as unread.
    """
    conn = await get_connection()
    
    try:
        # Get the lab request
        lab_request = await get_lab_request(request_id, labtechnician_id)
        
        # Check if already unread
        if not lab_request.is_read:
            return LabRequestResponse(**lab_request.to_dict())
        
        # Update to mark as unread
        update_data = {
            "is_read": False,
            "read_at": None
        }
        
        success = await update("lab_requests", request_id, update_data, conn=conn)
        
        if not success:
            raise BadRequestException("Failed to mark lab request as unread")
        
        # Add event to history
        event_data = {
            "lab_request_id": str(request_id),
            "event_type": "unread",
            "user_id": str(labtechnician_id),
            "details": json.dumps({
                "action": "marked_as_unread",
                "by_user": str(labtechnician_id)
            })
        }
        
        await conn.execute("""
            INSERT INTO lab_request_events 
            (lab_request_id, event_type, user_id, details)
            VALUES ($1, $2, $3, $4)
        """, event_data["lab_request_id"], event_data["event_type"], 
            event_data["user_id"], event_data["details"])
        
        # Get updated request
        query = "SELECT * FROM lab_requests WHERE id = $1"
        updated_row = await fetch_one(query, str(request_id), conn=conn)
        
        # Notify via WebSocket
        try:
            await broadcast_lab_request(
                str(request_id), 
                "lab_request_updated", 
                {"updates": {"is_read": False, "read_at": None}}
            )
        except Exception as e:
            # Log but don't fail on WebSocket errors
            print(f"WebSocket notification error: {str(e)}")
        
        return LabRequestResponse(**updated_row)
    finally:
        await conn.close()
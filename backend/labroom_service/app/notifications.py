# labroom_service/app/notifications.py
import uuid
import json
import asyncio
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
import logging
from .database import get_connection, insert, fetch_one, fetch_all
from .models import Notification, NotificationType
from .websocket import connected_clients, broadcast_to_user

logger = logging.getLogger(__name__)

async def create_notification(
    recipient_id: uuid.UUID,
    sender_id: uuid.UUID,
    title: str,
    message: str,
    notification_type: NotificationType,
    lab_request_id: Optional[uuid.UUID] = None,
    lab_result_id: Optional[uuid.UUID] = None,
    send_websocket: bool = True
) -> Dict[str, Any]:
    """
    Create a notification in the database and optionally send it via WebSocket.
    """
    conn = await get_connection()
    
    try:
        # Prepare notification data for database
        notification_data = {
            "recipient_id": str(recipient_id),  # Ensure UUIDs are converted to strings
            "sender_id": str(sender_id),
            "title": title,
            "message": message,
            "notification_type": notification_type.value,
            "is_read": False,
            "created_at": datetime.now()
        }
        
        if lab_request_id:
            notification_data["lab_request_id"] = str(lab_request_id)  # Convert UUID to string
        
        if lab_result_id:
            notification_data["lab_result_id"] = str(lab_result_id)  # Convert UUID to string
        
        # Insert notification into database
        notification_id = await insert("lab_notifications", notification_data, conn=conn)
        
        # Fetch created notification for WebSocket
        notification_row = await fetch_one(
            "SELECT * FROM lab_notifications WHERE id = $1",
            notification_id,
            conn=conn
        )
        
        # Send via WebSocket if requested
        if send_websocket and notification_row:
            try:
                await broadcast_to_user(
                    str(recipient_id),  # Convert UUID to string for WebSocket
                    {
                        "type": "new_notification",
                        "notification": notification_row
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send notification via WebSocket: {str(e)}")
        
        return notification_row
    except Exception as e:
        logger.error(f"Failed to create notification: {str(e)}")
        return None
    finally:
        await conn.close()

async def notify_test_result_ready(
    lab_result_id: str,  # Changed from UUID to str
    lab_request_id: str,  # Changed from UUID to str
    doctor_id: str,  # Changed from UUID to str
    sender_id: str,  # Changed from UUID to str
    patient_name: str
):
    """
    Send notification to doctor that a lab test result is ready.
    """
    # Use string IDs for the notification
    try:
        await create_notification(
            recipient_id=uuid.UUID(doctor_id),  # Convert string back to UUID
            sender_id=uuid.UUID(sender_id),  # Convert string back to UUID 
            title="Lab Result Ready",
            message=f"Lab test results for {patient_name} are now available",
            notification_type=NotificationType.LAB_RESULT_READY,
            lab_request_id=uuid.UUID(lab_request_id),  # Convert string back to UUID
            lab_result_id=uuid.UUID(lab_result_id),  # Convert string back to UUID
            send_websocket=True
        )
        
        logger.info(f"Notification sent to doctor {doctor_id} about lab result {lab_result_id}")
    except Exception as e:
        logger.error(f"Failed to send test result notification: {str(e)}")

async def notify_lab_request_assigned(
    lab_request_id: uuid.UUID,
    technician_id: uuid.UUID,
    sender_id: uuid.UUID,
    patient_name: str
):
    """
    Send notification to lab technician that a lab test has been assigned.
    """
    try:
        await create_notification(
            recipient_id=technician_id,
            sender_id=sender_id,
            title="New Lab Test Assignment",
            message=f"You have been assigned a new lab test for {patient_name}",
            notification_type=NotificationType.LAB_REQUEST_UPDATED,
            lab_request_id=lab_request_id,
            send_websocket=True
        )
        
        logger.info(f"Notification sent to technician {technician_id} about lab request {lab_request_id}")
    except Exception as e:
        logger.error(f"Failed to send lab request assignment notification: {str(e)}")
    
async def mark_notification_as_read(notification_id: uuid.UUID) -> bool:
    """Mark a notification as read"""
    conn = await get_connection()
    
    try:
        query = """
        UPDATE lab_notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE id = $1
        RETURNING id
        """
        
        result = await fetch_one(query, str(notification_id), conn=conn)
        return result is not None
    finally:
        await conn.close()

async def get_unread_notifications(user_id: uuid.UUID, limit: int = 50) -> List[Notification]:
    """Get unread notifications for a user"""
    conn = await get_connection()
    
    try:
        query = """
        SELECT * FROM lab_notifications
        WHERE recipient_id = $1 AND is_read = FALSE
        ORDER BY created_at DESC
        LIMIT $2
        """
        
        rows = await fetch_all(query, str(user_id), limit, conn=conn)
        return [Notification.from_db_row(row) for row in rows]
    finally:
        await conn.close()

async def get_all_notifications(
    user_id: uuid.UUID, 
    page: int = 1, 
    page_size: int = 20
) -> Dict[str, Any]:
    """Get all notifications for a user with pagination"""
    conn = await get_connection()
    
    try:
        # Get total count
        count_query = """
        SELECT COUNT(*) FROM lab_notifications
        WHERE recipient_id = $1
        """
        
        total = await conn.fetchval(count_query, str(user_id))
        
        # Get paginated notifications
        offset = (page - 1) * page_size
        
        query = """
        SELECT * FROM lab_notifications
        WHERE recipient_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """
        
        rows = await fetch_all(query, str(user_id), page_size, offset, conn=conn)
        notifications = [Notification.from_db_row(row) for row in rows]
        
        # Calculate total pages
        total_pages = (total + page_size - 1) // page_size
        
        return {
            "items": [n.to_dict() for n in notifications],
            "total": total,
            "page": page,
            "size": page_size,
            "pages": total_pages
        }
    finally:
        await conn.close()
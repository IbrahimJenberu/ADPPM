# doctor_service/app/notifications.py
import uuid
import asyncpg
import json
import logging
import httpx
from app.config import settings
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.websocket import manager

async def create_notification_for_role(
    pool,
    role: str,
    title: str,
    content: str,
    notification_type: str,
    related_id: str  # Change parameter type to string
) -> List[Dict[str, Any]]:
    """Create notifications for all users with a specific role."""
    from .utils.lab_service import send_notification_to_lab_tech
    
    async with pool.acquire() as conn:
        # Get all users with the specified role
        user_query = "SELECT id FROM users WHERE role = $1 AND is_active = true"
        user_records = await conn.fetch(user_query, role)
        
        notifications = []
        
        for user_record in user_records:
            user_id = user_record["id"]
            
            # Special handling for lab technicians
            if role == "lab_technician":
                # Try to send notification to lab service
                entity_id = uuid.UUID(related_id) if related_id else None
                
                success = await send_notification_to_lab_tech(
                    lab_tech_id=user_id,
                    sender_id=entity_id or uuid.uuid4(),  # Use entity ID or generate a random one
                    message=f"{title}: {content}",
                    notification_type=notification_type,
                    lab_request_id=entity_id if "lab_request" in notification_type else None,
                    additional_data={"title": title}
                )
                
                if success:
                    # Add a placeholder for tracking
                    notifications.append({
                        "id": str(uuid.uuid4()),
                        "recipient_id": str(user_id),
                        "message": f"{title}: {content}",
                        "notification_type": notification_type,
                        "entity_id": related_id,
                        "is_read": False,
                        "created_at": datetime.now().isoformat()
                    })
            else:
                # For other roles, use the existing notification system
                notification = await create_notification(
                    pool, user_id, title, content, notification_type, related_id
                )
                notifications.append(notification)
            
        return notifications

async def create_notification(
    pool,
    user_id: uuid.UUID,
    title: str,
    content: str,
    notification_type: str,
    related_id: str  # Change parameter type to string
) -> Dict[str, Any]:
    """Create a new notification and send it via WebSocket if user is online."""
    async with pool.acquire() as conn:
        notification_id = uuid.uuid4()
        
        # Update query to match your actual database schema
        query = """
            INSERT INTO notifications (
                id, recipient_id, message, notification_type, entity_id, is_read
            )
            VALUES ($1, $2, $3, $4, $5, false)
            RETURNING *
        """
        
        # Convert related_id string back to UUID if needed for database
        entity_id = uuid.UUID(related_id) if related_id else None
        
        record = await conn.fetchrow(
            query,
            notification_id,
            user_id,
            f"{title}: {content}",  # Combine title and content into message
            notification_type,
            entity_id,
        )
        
        notification = dict(record)
        
        # Update this section to match your schema
        try:
            # Send real-time notification if user is connected
            await manager.send_personal_message(
                {
                    "type": "notification",
                    "data": {
                        "id": str(notification["id"]),
                        "message": notification["message"],
                        "notification_type": notification["notification_type"],
                        "entity_id": str(notification["entity_id"]) if notification.get("entity_id") else None,
                        "created_at": notification["created_at"].isoformat(),
                        "is_read": notification["is_read"]
                    }
                },
                str(user_id)
            )
        except Exception as e:
            logging.error(f"Failed to send notification via WebSocket: {str(e)}")
        
        return notification

async def mark_notification_as_read(
    pool,
    notification_id: uuid.UUID,
    user_id: uuid.UUID
) -> Optional[Dict[str, Any]]:
    """Mark a notification as read."""
    async with pool.acquire() as conn:
        query = """
            UPDATE notifications
            SET is_read = true, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *
        """
        
        record = await conn.fetchrow(query, notification_id, user_id)
        
        if not record:
            return None
            
        return dict(record)

async def get_user_notifications(
    pool,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False
) -> Dict[str, Any]:
    """Get notifications for a user."""
    async with pool.acquire() as conn:
        conditions = ["user_id = $1"]
        params = [user_id]
        
        if unread_only:
            conditions.append("is_read = false")
            
        where_clause = " AND ".join(conditions)
        
        # Get total count
        count_query = f"SELECT COUNT(*) FROM notifications WHERE {where_clause}"
        total = await conn.fetchval(count_query, *params)
        
        # Get notifications
        query = f"""
            SELECT *
            FROM notifications
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """
        
        records = await conn.fetch(query, *params, limit, offset)
        
        return {
            "notifications": [dict(record) for record in records],
            "total": total
        }

logger = logging.getLogger(__name__)

async def send_notification_to_lab_service(
    recipient_id: uuid.UUID,
    sender_id: uuid.UUID,
    message: str,
    notification_type: str,
    entity_id: uuid.UUID = None,
    entity_type: str = None,
    additional_data: Dict[str, Any] = None
) -> bool:
    """Send a notification to the lab service for a specific lab technician."""
    try:
        lab_service_url = settings.LAB_SERVICE_URL
        notification_endpoint = f"{lab_service_url}/inter-service/notifications"
        
        # Prepare notification data
        notification_data = {
            "recipient_id": str(recipient_id),
            "sender_id": str(sender_id),
            "message": message,
            "notification_type": notification_type,
            "additional_data": additional_data or {}
        }
        
        if entity_id:
            notification_data["entity_id"] = str(entity_id)
            
        if entity_type:
            notification_data["entity_type"] = entity_type
            
        # Send the notification to the lab service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                notification_endpoint,
                json=notification_data,
                timeout=10.0  # Set a reasonable timeout
            )
            
            response.raise_for_status()  # Raise exception for non-2xx responses
            return True
            
    except Exception as e:
        logger.error(f"Failed to send notification to lab service: {str(e)}")
        return False
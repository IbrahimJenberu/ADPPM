# doctor_service/app/routers/notifications.py
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from typing import Optional
from asyncpg import Connection
from pydantic import UUID4
import logging
from datetime import datetime

from app.schemas import NotificationCreate, NotificationResponse, NotificationsResponse
from app.models import NotificationModel
from app.dependencies import get_db_pool
from app.websocket import manager

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    notification: NotificationCreate,
    conn: Connection = Depends(get_db_pool),
):
    """Create a new notification."""
    notification_data = notification.dict()
    
    # Create notification
    result = await NotificationModel.create(conn, notification_data)
    
    # Send notification via WebSocket
    await manager.send_personal_message(
        str(notification.recipient_id),
        {"type": "notification", "data": result}
    )
    
    return result

@router.get("/", response_model=NotificationsResponse)
async def get_user_notifications(
    user_id: UUID4,
    page: int = 1,
    page_size: int = 20,
    conn: Connection = Depends(get_db_pool),
):
    """Get notifications for a specific user."""
    # Calculate offset
    offset = (page - 1) * page_size
    
    # Get notifications
    notifications, total = await NotificationModel.get_user_notifications(
        conn, user_id, page_size, offset
    )
    
    return NotificationsResponse(
        data=notifications,
        total=total,
        page=page,
        page_size=page_size
    )

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID4,
    conn: Connection = Depends(get_db_pool),
):
    """Mark a notification as read."""
    # Get notification
    notification = await NotificationModel.get_by_id(conn, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Mark as read
    updated = await NotificationModel.mark_as_read(conn, notification_id)
    return updated
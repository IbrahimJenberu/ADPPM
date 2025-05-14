"""
Utilities for sending notifications to users.
"""
import httpx
import logging
import json
import uuid
from typing import Dict, Any, Optional, List
from app.config import settings
from app.websocket import connection_manager
from app.schemas import NotificationCreate

async def send_notification(notification: NotificationCreate):
    """
    Send a notification to a user through the notification service
    and WebSocket if the user is connected.
    """
    try:
        # Send to notification service first
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.NOTIFICATION_SERVICE_URL}/api/notifications",
                json=notification.dict(),
                timeout=5.0
            )
            
            if response.status_code != 201:
                logging.error(f"Failed to send notification: {response.text}")
        
        # Also send via WebSocket if user is connected
        await connection_manager.send_personal_message(
            str(notification.recipient_id),
            {
                "type": "notification",
                "data": notification.dict()
            }
        )
        
    except Exception as e:
        logging.error(f"Error sending notification: {str(e)}")

async def send_opd_assignment_notification(
    *,
    recipient_id: uuid.UUID,
    title: str,
    message: str,
    entity_type: str,
    entity_id: uuid.UUID
):
    await send_notification(NotificationCreate(
        recipient_id=recipient_id,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id
    ))


async def send_appointment_notification(
    patient_name: str,
    doctor_id: uuid.UUID, 
    appointment_id: uuid.UUID,
    appointment_date: str
):
    """Send notification about a new appointment to a doctor."""
    await send_notification(NotificationCreate(
        recipient_id=doctor_id,
        title="New Appointment Scheduled",
        message=f"Appointment with {patient_name} scheduled for {appointment_date}.",
        entity_type="appointments",
        entity_id=appointment_id
    ))

async def send_appointment_update_notification(
    patient_name: str,
    doctor_id: uuid.UUID,
    appointment_id: uuid.UUID,
    appointment_date: str,
    status: str
):
    """Send notification about an appointment update to a doctor."""
    await send_notification(NotificationCreate(
        recipient_id=doctor_id,
        title="Appointment Updated",
        message=f"Appointment with {patient_name} for {appointment_date} has been {status.lower()}.",
        entity_type="appointments",
        entity_id=appointment_id
    ))

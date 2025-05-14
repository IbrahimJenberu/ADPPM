# labroom_service/app/routes/websocket_routes.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any
from ..database import get_connection, insert, fetch_one
from ..websocket import broadcast_lab_request
import logging, json, uuid
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["WebSockets"])

@router.websocket("/lab-requests/{technician_id}")
async def lab_requests_websocket(websocket: WebSocket, technician_id: str):
    await websocket.accept()
    try:
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to lab requests WebSocket",
            "technician_id": technician_id
        })
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            if message.get("type") == "new_lab_request":
                lab_request_data = message.get("data", {})

                # Acknowledge immediately
                await websocket.send_json({
                    "type": "lab_request_received",
                    "request_id": lab_request_data.get("id"),
                    "timestamp": datetime.utcnow().isoformat()
                })

                # Process and broadcast
                await process_incoming_lab_request(lab_request_data)
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")

async def process_incoming_lab_request(lab_request_data: Dict[str, Any]) -> None:
    logger.info(f"Processing incoming lab request: {lab_request_data}")
    conn = await get_connection()

    # Convert created_at string to datetime
    raw_created = lab_request_data.get("created_at")
    if isinstance(raw_created, str):
        try:
            created_dt = datetime.fromisoformat(raw_created)
        except ValueError:
            created_dt = datetime.utcnow()
    else:
        created_dt = raw_created or datetime.utcnow()

    try:
        # 1) Insert and get back just the new ID
        new_id = await insert(
            table="lab_requests",
            data={
                "id":         lab_request_data["id"],
                "patient_id": lab_request_data["patient_id"],
                "doctor_id":  lab_request_data["doctor_id"],
                "test_type":  lab_request_data["test_type"],
                "priority":   lab_request_data["priority"],
                "status":     lab_request_data["status"],
                "notes":      lab_request_data["notes"],
                "created_at": created_dt
            },
            returning="id"
        )

        # 2) Fetch the full row as a dict
        inserted = await fetch_one(
            "SELECT * FROM lab_requests WHERE id = $1",
            new_id,
            conn=conn
        )

        # Prepare broadcast payload
        patient_name = lab_request_data.get("patient_name", "Unknown patient")
        doctor_name  = lab_request_data.get("doctor_name",  "Unknown doctor")

        lab_request_message = {
            "id":           str(inserted["id"]),
            "patient_id":   inserted["patient_id"],
            "patient_name": patient_name,
            "doctor_id":    inserted["doctor_id"],
            "doctor_name":  doctor_name,
            "test_type":    inserted["test_type"],
            "priority":     inserted["priority"],
            "status":       inserted["status"],
            "notes":        inserted["notes"],
            "created_at":   inserted["created_at"].isoformat(),
            "is_read":      False
        }

        # 3) Broadcast
        await broadcast_lab_request(
            str(inserted["id"]),  # lab_request_id as first parameter
            "new_lab_request",    # event_type as second parameter
            {"lab_request": lab_request_message}  # data payload as third parameter
        )
        logger.info(f"Broadcast new lab request {inserted['id']}")

    finally:
        await conn.close()

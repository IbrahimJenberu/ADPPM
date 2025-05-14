# doctor_service/app/routers/appointments.py
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from uuid import UUID
from datetime import datetime, date, time, timezone, timedelta
from typing import List, Optional

from app import models, schemas
from app.dependencies import get_db_pool, get_current_doctor
from app.exceptions import AppointmentNotFoundException, DatabaseException
from app.services.cardroom_service import (
    get_doctor_appointments_from_cardroom,
    update_cardroom_appointment,
    get_single_appointment_from_cardroom
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

def parse_utc_datetime(dt_str: str) -> datetime:
    """Parse UTC datetime string with Z suffix"""
    if dt_str.endswith('Z'):
        dt_str = dt_str.replace('Z', '+00:00')
    return datetime.fromisoformat(dt_str).astimezone(timezone.utc)

@router.get("/", response_model=schemas.AppointmentsListResponse)
async def get_appointments(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Get appointments from Cardroom Service"""
    try:
        today = datetime.now(timezone.utc).date()
        
        # Set default date range if not provided
        if date_from is None and date_to is None:
            date_from = today
            date_to = today + timedelta(days=30)
        elif date_from is None:
            date_from = date_to - timedelta(days=30)
        elif date_to is None:
            date_to = date_from + timedelta(days=30)
        
        # Validate date range does not exceed 31 days
        if (date_to - date_from).days > 30:
            raise HTTPException(
                status_code=400,
                detail="Date range cannot exceed 31 days"
            )
        
        # Convert dates to datetime objects with start and end of day
        start_datetime = datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc)
        end_datetime = datetime.combine(date_to, time.max).replace(tzinfo=timezone.utc)
        
        # Fetch appointments from Cardroom Service
        appointments = await get_doctor_appointments_from_cardroom(
            doctor_id=doctor_id,
            start_date=start_datetime,
            end_date=end_datetime
        )

        # Transform and validate appointment data
        processed = []
        for appt in appointments:
            try:
                processed.append({
                    "id": appt["id"],
                    "patient_id": appt["patient_id"],
                    "doctor_id": appt["doctor_id"],
                    "appointment_datetime": parse_utc_datetime(appt["appointment_date"]),
                    "duration_minutes": appt["duration_minutes"],
                    "appointment_type": appt["appointment_type"],
                    "status": appt["status"],
                    "reason": appt.get("reason"),
                    "notes": appt.get("notes"),
                    "created_at": parse_utc_datetime(appt["created_at"]),
                    "updated_at": parse_utc_datetime(appt["updated_at"]) if appt.get("updated_at") else None,
                    "patient_name": appt["patient_name"],
                    "doctor_name": appt["doctor_name"]
                })
            except KeyError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Invalid appointment data from Cardroom Service: Missing field {str(e)}"
                )

        # Apply status filter if provided
        if status_filter:
            processed = [a for a in processed if a["status"].lower() == status_filter.lower()]
            
        # Pagination
        total = len(processed)
        paginated = processed[skip : skip + limit]
        
        return {
            "success": True,
            "message": "Appointments retrieved successfully",
            "appointments": paginated,
            "total": total
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise DatabaseException(detail=f"Failed to fetch appointments: {str(e)}")

@router.patch("/{appointment_id}", response_model=schemas.AppointmentUpdateResponse)
async def update_appointment_status(
    update_data: schemas.AppointmentUpdate,
    appointment_id: UUID = Path(...),
):
    """Update an appointment's status through Cardroom Service"""
    try:
        # Get appointment directly from Cardroom Service
        appointment = await get_single_appointment_from_cardroom(appointment_id)
        
        if not appointment:
            raise AppointmentNotFoundException()

        # Update through Cardroom Service API
        updated = await update_cardroom_appointment(
            appointment_id=appointment_id,
            status=update_data.status.upper(),
            notes=update_data.notes
        )
        
        # Parse and format response data
        formatted_appointment = {
            "id": updated["id"],
            "patient_id": updated["patient_id"],
            "doctor_id": updated["doctor_id"],
            "appointment_datetime": parse_utc_datetime(updated["appointment_date"]),
            "duration_minutes": updated["duration_minutes"],
            "appointment_type": updated["appointment_type"],
            "status": updated["status"],
            "reason": updated.get("reason"),
            "notes": updated.get("notes"),
            "created_at": parse_utc_datetime(updated["created_at"]),
            "updated_at": parse_utc_datetime(updated["updated_at"]) if updated.get("updated_at") else None,
            "patient_name": updated["patient_name"],
            "doctor_name": updated["doctor_name"]
        }
        
        return {
            "success": True,
            "message": f"Appointment {update_data.status} successfully",
            "appointment": formatted_appointment
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise DatabaseException(detail=str(e))
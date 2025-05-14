"""
Router for appointment-related endpoints.
"""
from fastapi import APIRouter, Depends, Path, Query, HTTPException, status
from uuid import UUID
from typing import Optional, List, Dict, Any
from asyncpg import Connection
import uuid
from datetime import datetime, timedelta

from app.schemas import (
    AppointmentCreate, AppointmentUpdate, AppointmentResponse,
    AppointmentsResponse, BaseResponse, AppointmentDateRange
)
from app.models import AppointmentModel, PatientModel, DoctorModel
from app.services.auth_service import get_doctor_from_auth
from app.dependencies import get_db_connection, get_transaction
from app.exceptions import ResourceNotFoundException, ConflictException, BadRequestException
from app.notifications import send_appointment_notification, send_appointment_update_notification

router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
    dependencies=[]  # Clear any router-level security dependencies
)

@router.post("/", response_model=AppointmentResponse)
async def create_appointment(
    appointment: AppointmentCreate,
    conn: Connection = Depends(get_transaction),
):
    """Create a new appointment."""
    # Verify patient exists
    patient = await PatientModel.get_by_id(appointment.patient_id)
    if not patient:
        raise ResourceNotFoundException("Patient", str(appointment.patient_id))

    # Verify doctor exists (through auth service)
    doctor = await get_doctor_from_auth(appointment.doctor_id)
    if not doctor:
        raise ResourceNotFoundException("Doctor", str(appointment.doctor_id))

    # Check for time conflicts
    conflict = await AppointmentModel.check_conflicts(
        doctor_id=appointment.doctor_id,
        appointment_date=appointment.appointment_date,
        duration_minutes=appointment.duration_minutes
    )
    if conflict:
        raise ConflictException(
            message="This time slot conflicts with an existing appointment",
            details={"appointment_date": appointment.appointment_date.isoformat()}
        )

    # Prepare creation data
    appointment_data = appointment.dict()
    appointment_data["status"] = "SCHEDULED"  # Default status

    # Create appointment
    created = await AppointmentModel.create(appointment_data)
    if not created:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create appointment"
        )

    # Fetch full appointment data with joins
    new_appointment = await AppointmentModel.get_by_id(created["id"])

    return new_appointment

@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment: AppointmentUpdate,
    appointment_id: UUID = Path(..., description="Appointment UUID"),
    conn: Connection = Depends(get_transaction),
):
    """Update an appointment."""
    # Verify appointment exists with full data
    existing = await AppointmentModel.get_by_id(appointment_id)
    if not existing:
        raise ResourceNotFoundException("Appointment", str(appointment_id))
    
    # Get update data
    update_data = appointment.dict(exclude_unset=True)
    
    # Check for conflicts if date/duration are being changed
    if "appointment_date" in update_data or "duration_minutes" in update_data:
        doctor_id = existing["doctor_id"]
        duration = update_data.get("duration_minutes", existing["duration_minutes"])
        appointment_date = update_data.get("appointment_date", existing["appointment_date"])
        
        conflict = await AppointmentModel.check_conflicts(
            doctor_id=doctor_id,
            appointment_date=appointment_date,
            duration_minutes=duration,
            exclude_id=appointment_id
        )
        
        if conflict:
            raise ConflictException(
                message="This time slot conflicts with an existing appointment",
                details={"appointment_date": appointment_date.isoformat()}
            )
    
    # Perform the update
    updated = await AppointmentModel.update(appointment_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update appointment"
        )

    # Explicitly fetch fresh data with joins
    updated_appointment = await AppointmentModel.get_by_id(appointment_id)
    if not updated_appointment:
        raise ResourceNotFoundException("Appointment", str(appointment_id))
    
    return updated_appointment


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: UUID = Path(..., description="Appointment UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get a single appointment by ID."""
    appointment = await AppointmentModel.get_by_id(appointment_id)
    if not appointment:
        raise ResourceNotFoundException("Appointment", str(appointment_id))
    
    return appointment

@router.get("/", response_model=AppointmentsResponse)
async def list_appointments(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    patient_id: Optional[UUID] = Query(None, description="Filter by patient ID"),
    doctor_id: Optional[UUID] = Query(None, description="Filter by doctor ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    from_date: Optional[datetime] = Query(None, description="Filter from date"),
    to_date: Optional[datetime] = Query(None, description="Filter to date"),
    conn: Connection = Depends(get_db_connection),
):
    """List appointments with pagination and filters."""
    offset = (page - 1) * page_size
    filters = {}
    
    if patient_id:
        filters["patient_id"] = patient_id
    if doctor_id:
        filters["doctor_id"] = doctor_id
    if status:
        filters["status"] = status
    if from_date:
        filters["appointment_date >= "] = from_date
    if to_date:
        filters["appointment_date <= "] = to_date

    appointments, total = await AppointmentModel.list(
        limit=page_size, 
        offset=offset,
        **filters
    )
    
    pages = (total + page_size - 1) // page_size
    return AppointmentsResponse(
        data=appointments,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/patient/{patient_id}", response_model=List[AppointmentResponse])
async def get_patient_appointments(
    patient_id: UUID = Path(..., description="Patient UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get all appointments for a patient."""
    patient = await PatientModel.get_by_id(patient_id)
    if not patient:
        raise ResourceNotFoundException("Patient", str(patient_id))
    
    appointments = await AppointmentModel.get_patient_appointments(patient_id)
    return appointments

@router.post("/doctor/{doctor_id}/schedule", response_model=List[AppointmentResponse])
async def get_doctor_schedule(
    date_range: AppointmentDateRange,
    doctor_id: UUID = Path(..., description="Doctor UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get doctor's schedule for a date range."""
    # Check date range first
    delta = date_range.end_date - date_range.start_date
    if delta.total_seconds() > 60 * 86400:
        raise BadRequestException(
            message="Date range cannot exceed 31 days",
            details={
                "start_date": date_range.start_date.isoformat(),
                "end_date": date_range.end_date.isoformat()
            }
        )
    
    # Verify doctor exists
    doctor = await DoctorModel.get_by_id(doctor_id)
    if not doctor:
        raise ResourceNotFoundException("Doctor", str(doctor_id))
    
    # Fetch appointments
    appointments = await AppointmentModel.get_doctor_appointments(
        doctor_id,
        date_range.start_date,
        date_range.end_date
    )
    
    return appointments

@router.post("/check-conflicts", response_model=BaseResponse)
async def check_appointment_conflicts(
    appointment: AppointmentCreate,
    conn: Connection = Depends(get_db_connection),
):
    """Check appointment time conflicts."""
    conflict = await AppointmentModel.check_conflicts(
        appointment.doctor_id,
        appointment.appointment_date,
        appointment.duration_minutes
    )
    
    if conflict:
        return BaseResponse(
            success=False,
            message="This time slot conflicts with an existing appointment"
        )
    
    return BaseResponse(
        success=True,
        message="Time slot is available"
    )
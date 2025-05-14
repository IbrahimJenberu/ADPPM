# cardroom_service/app/routers/opd.py

from fastapi import APIRouter, Depends, Path, Query, HTTPException, status, Request
from uuid import UUID
from datetime import date
from typing import Optional, List, Dict, Any
from asyncpg import Connection
import uuid
from datetime import datetime
import logging

from app.schemas import (
    OPDAssignmentCreate, OPDAssignmentUpdate, OPDAssignmentResponse,
    OPDAssignmentsResponse, BaseResponse, PatientResponse
)
from app.security import card_room_worker_only
from app.models import OPDAssignmentModel, PatientModel, DoctorModel
from app.dependencies import get_db_connection, get_transaction
from app.exceptions import ResourceNotFoundException, BadRequestException, ServiceUnavailableException
#from app.notifications import send_opd_assignment_notification as send_notification_to_doctor
from app.services.auth_service import get_doctor_from_auth
from app.services.doctor_service import send_notification_to_doctor

router = APIRouter(
    prefix="/opd-assignments",
    tags=["OPD Assignments"],
)

@router.post("/", 
    response_model=OPDAssignmentResponse, 
    status_code=status.HTTP_201_CREATED
)
async def create_opd_assignment(
    assignment: OPDAssignmentCreate,
    token_data: Dict[str, Any] = Depends(card_room_worker_only),
    conn: Connection = Depends(get_transaction)   
):
    """Assign a patient to a doctor's OPD."""
    # Verify patient exists
    patient = await PatientModel.get_by_id(assignment.patient_id)
    if not patient:
        raise ResourceNotFoundException("Patient", str(assignment.patient_id))
    
    # Fetch doctor details from auth service
    doctor = await get_doctor_from_auth(assignment.doctor_id)
    if not doctor:
        raise ResourceNotFoundException("Doctor", str(assignment.doctor_id))
    
    # Create assignment with the current user as assigner
    assignment_data = assignment.dict()
    assignment_data["status"] = "PENDING"
    
    try:
        # Create basic assignment
        result = await OPDAssignmentModel.create(assignment_data)
        assignment_id = result["id"]
        
        # Fetch full assignment with joins
        full_assignment = await OPDAssignmentModel.get_by_id_with_joins(assignment_id)
        if not full_assignment:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created assignment"
            )
            
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise BadRequestException("This patient is already assigned to the same doctor")
        raise
    
    # Prepare and store doctor data
    doctor_data = {
        "id": doctor["id"],
        "full_name": doctor["full_name"],
        "department": doctor["department"],
        "is_available": True
    }
    await DoctorModel.upsert(doctor_data)
    
    # Send notification
    patient_name = f"{patient['first_name']} {patient['last_name']}"
    try:
        await send_notification_to_doctor(
            recipient_id=assignment.doctor_id,
            title="New Patient Assigned",
            message=f"Patient {patient_name} has been assigned to you for OPD consultation.",
            entity_type="opd_assignments",
            entity_id=full_assignment["id"]
        )
    except ServiceUnavailableException as e:
        logging.error(
            "Notification failed but OPD assignment succeeded. Error: %s - Assignment ID: %s",
            str(e),
            full_assignment["id"]
        )
    except Exception as e:
        logging.error(
            "Unexpected notification error. Assignment ID: %s - Error: %s",
            full_assignment["id"],
            str(e),
            exc_info=True
        )

    try:
        from app.websocket import broadcast_opd_assignment
        
        # Get complete patient data to include in notification
        patient = await PatientModel.get_by_id(assignment.patient_id)
        if not patient:
            logging.warning(f"Patient {assignment.patient_id} not found for notification")
        
        # Prepare assignment data with complete patient information
        assignment_data = {
            "id": str(full_assignment["id"]),
            "doctor_id": str(full_assignment["doctor_id"]),
            "patient_id": str(full_assignment["patient_id"]),
            "status": full_assignment["status"],
            "priority": full_assignment["priority"],
            "notes": full_assignment.get("notes"),
            "created_at": full_assignment["created_at"].isoformat() if isinstance(full_assignment["created_at"], datetime) else full_assignment["created_at"],
            "doctor_name": full_assignment.get("doctor_name"),
            "doctor_specialty": full_assignment.get("doctor_specialty"),
            "patient_name": full_assignment.get("patient_name"),
            "patient_registration": full_assignment.get("patient_registration"),
            # Include complete patient data
            "patient": {
                "id": str(patient["id"]),
                "registration_number": patient.get("registration_number"),
                "first_name": patient.get("first_name"),
                "last_name": patient.get("last_name"),
                "date_of_birth": patient.get("date_of_birth").isoformat() if isinstance(patient.get("date_of_birth"), date) else patient.get("date_of_birth"),
                "gender": patient.get("gender"),
                "blood_group": patient.get("blood_group"),
                "phone_number": patient.get("phone_number"),
                "email": patient.get("email"),
                "address": patient.get("address"),
                "emergency_contact_name": patient.get("emergency_contact_name"),
                "emergency_contact_phone": patient.get("emergency_contact_phone"),
                "allergies": patient.get("allergies", []),
                "medical_history": patient.get("medical_history", {})
            } if patient else None
        }
        
        # Broadcast to WebSocket connections
        await broadcast_opd_assignment(
            assignment.doctor_id,
            assignment.patient_id,
            full_assignment["id"],
            assignment_data
        )
    except Exception as e:
        logging.error(
            "WebSocket notification failed but OPD assignment succeeded. Error: %s - Assignment ID: %s",
            str(e),
            full_assignment["id"],
            exc_info=True
        )
    
    return full_assignment

@router.get("/{assignment_id}", response_model=OPDAssignmentResponse)
async def get_opd_assignment(
    assignment_id: UUID = Path(..., description="OPD Assignment UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get an OPD assignment by ID."""
    result = await OPDAssignmentModel.get_by_id_with_joins(assignment_id)
    if not result:
        raise ResourceNotFoundException("OPD Assignment", str(assignment_id))
    return result

@router.put("/{assignment_id}", response_model=OPDAssignmentResponse)
async def update_opd_assignment(
    assignment: OPDAssignmentUpdate,
    assignment_id: UUID = Path(..., description="OPD Assignment UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Update an OPD assignment."""
    existing = await OPDAssignmentModel.get_by_id(assignment_id)
    if not existing:
        raise ResourceNotFoundException("OPD Assignment", str(assignment_id))
    
    updated = await OPDAssignmentModel.update(assignment_id, assignment.dict(exclude_unset=True))
    return updated

@router.delete("/{assignment_id}", response_model=BaseResponse)
async def delete_opd_assignment(
    assignment_id: UUID = Path(..., description="OPD Assignment UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Cancel/delete an OPD assignment."""
    existing = await OPDAssignmentModel.get_by_id(assignment_id)
    if not existing:
        raise ResourceNotFoundException("OPD Assignment", str(assignment_id))
    
    success = await OPDAssignmentModel.delete(assignment_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete OPD assignment"
        )
    
    return BaseResponse(message="OPD assignment deleted successfully")

@router.get("/", response_model=OPDAssignmentsResponse)
async def list_opd_assignments(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    patient_id: Optional[UUID] = Query(None, description="Filter by patient ID"),
    doctor_id: Optional[UUID] = Query(None, description="Filter by doctor ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    conn: Connection = Depends(get_db_connection),
):
    """List OPD assignments with pagination and filters."""
    offset = (page - 1) * page_size
    filters = {}
    if patient_id:
        filters["patient_id"] = patient_id
    if doctor_id:
        filters["doctor_id"] = doctor_id
    if status:
        filters["status"] = status
    
    assignments, total = await OPDAssignmentModel.list(
        limit=page_size, 
        offset=offset,
        **filters
    )
    
    pages = (total + page_size - 1) // page_size
    return OPDAssignmentsResponse(
        data=assignments,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/patient/{patient_id}", response_model=List[OPDAssignmentResponse])
async def get_patient_assignments(
    patient_id: UUID = Path(..., description="Patient UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get all OPD assignments for a patient."""
    patient = await PatientModel.get_by_id(patient_id)
    if not patient:
        raise ResourceNotFoundException("Patient", str(patient_id))
    
    assignments = await OPDAssignmentModel.get_patient_assignments(patient_id)
    return assignments

@router.get("/doctor/{doctor_id}", response_model=List[OPDAssignmentResponse])
async def get_doctor_assignments(
    doctor_id: UUID = Path(..., description="Doctor UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get all patients assigned to a doctor."""
    assignments = await OPDAssignmentModel.get_doctor_assignments(doctor_id)
    return assignments

@router.get("/doctor/{doctor_id}/schedule", response_model=List[OPDAssignmentResponse])
async def get_doctor_schedule(
    doctor_id: UUID = Path(..., description="Doctor UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get doctor's OPD schedule"""
    # Verify doctor exists in auth service
    doctor = await get_doctor_from_auth(doctor_id)
    if not doctor:
        raise ResourceNotFoundException("Doctor", str(doctor_id))
    
    assignments = await OPDAssignmentModel.get_doctor_assignments(doctor_id)
    return assignments

# cardroom_service/app/routes/opd.py - Add this new endpoint

@router.get("/doctor/{doctor_id}/patients", response_model=List[PatientResponse])
async def get_doctor_patients(
    doctor_id: UUID = Path(..., description="Doctor UUID"),
    conn: Connection = Depends(get_db_connection),
):
    """Get all patients assigned to a doctor with full patient details."""
    # Get all assignments for this doctor
    assignments = await OPDAssignmentModel.get_doctor_assignments(doctor_id)
    
    if not assignments:
        return []
    
    # Extract unique patient IDs
    patient_ids = set(assignment["patient_id"] for assignment in assignments)
    
    # Batch fetch all patients in a single database query
    patients = []
    query = """
        SELECT * FROM patients 
        WHERE id = ANY($1) AND is_deleted = FALSE
    """
    results = await conn.fetch(query, list(patient_ids))
    return [dict(result) for result in results]
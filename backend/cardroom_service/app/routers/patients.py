# cardroom_service/app/routes/patients.py
"""
Router for patient-related endpoints.
"""
from fastapi import APIRouter, Depends, Path, Query, HTTPException, status
from uuid import UUID
from typing import Optional, List, Dict, Any
from asyncpg import Connection
import uuid

from app.schemas import (
    PatientCreate, PatientUpdate, PatientResponse, PatientSearchParams,
    PatientsResponse, BaseResponse
)
from app.models import PatientModel
from app.dependencies import get_db_connection
from app.security import card_room_worker_only
from app.exceptions import ResourceNotFoundException, ConflictException

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient: PatientCreate,
    conn: Connection = Depends(get_db_connection),
    token_data: Dict[str, Any] = Depends(card_room_worker_only)
):
    """Create a new patient record."""
    try:
        # Generate a unique registration number (format: P-YYYYMMDD-XXXXX)
        from datetime import datetime
        import random
        date_part = datetime.now().strftime("%Y%m%d")
        random_part = f"{random.randint(0, 99999):05d}"
        registration_number = f"P-{date_part}-{random_part}"
        
        patient_data = patient.dict()
        patient_data["registration_number"] = registration_number
        patient_data["medical_history"] = {}
        
        result = await PatientModel.create(patient_data)
        return result
    except Exception as e:
        # Check for duplicate registration number (rare but possible)
        if "duplicate key" in str(e).lower() and "registration_number" in str(e).lower():
            raise ConflictException(
                message="Registration number already exists. Please try again.",
                details={"error": str(e)}
            )
        raise

@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID = Path(..., description="Patient UUID"),
    conn: Connection = Depends(get_db_connection),
    token_data: Dict[str, Any] = Depends(card_room_worker_only)
):
    """Get a patient by ID."""
    result = await PatientModel.get_by_id(patient_id)
    if not result:
        raise ResourceNotFoundException("Patient", str(patient_id))
    return result

@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient: PatientUpdate,
    patient_id: UUID = Path(..., description="Patient UUID"),
    conn: Connection = Depends(get_db_connection),
    token_data: Dict[str, Any] = Depends(card_room_worker_only)
):
    """Update a patient's information."""
    # Verify patient exists
    existing = await PatientModel.get_by_id(patient_id)
    if not existing:
        raise ResourceNotFoundException("Patient", str(patient_id))
    
    # Update patient
    updated = await PatientModel.update(patient_id, patient.dict(exclude_unset=True))
    return updated

@router.delete("/{patient_id}", response_model=BaseResponse)
async def delete_patient(
    patient_id: UUID = Path(..., description="Patient UUID"),
    conn: Connection = Depends(get_db_connection),
    token_data: Dict[str, Any] = Depends(card_room_worker_only)
):
    """Soft delete a patient."""
    # Verify patient exists
    existing = await PatientModel.get_by_id(patient_id)
    if not existing:
        raise ResourceNotFoundException("Patient", str(patient_id))
    
    # Delete patient (soft delete)
    success = await PatientModel.delete(patient_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete patient"
        )
    
    return BaseResponse(message=f"Patient {existing['registration_number']} deleted successfully")

@router.get("/", response_model=PatientsResponse)
async def list_patients(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    conn: Connection = Depends(get_db_connection),
    token_data: Dict[str, Any] = Depends(card_room_worker_only)
):
    """List patients with pagination."""
    # Calculate offset
    offset = (page - 1) * page_size
    
    # Get patients with total count
    patients, total = await PatientModel.list(limit=page_size, offset=offset)
    total_pages = (total + page_size - 1) // page_size  # ceil division
    
    return PatientsResponse(
        data=patients,
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages 
    )

@router.post("/search", response_model=PatientsResponse)
async def search_patients(
    search_params: PatientSearchParams,
    conn: Connection = Depends(get_db_connection),
    token_data: Dict[str, Any] = Depends(card_room_worker_only)
):
    """Search patients by name or other criteria."""
    # Calculate offset
    offset = (search_params.page - 1) * search_params.page_size
    
    # Search patients by name
    if search_params.query:
        patients, total = await PatientModel.search_by_name(
            name=search_params.query,
            limit=search_params.page_size,
            offset=offset
        )
    else:
        # If no query provided, return all patients
        patients, total = await PatientModel.list(
            limit=search_params.page_size,
            offset=offset
        )
    
    return PatientsResponse(
        data=patients,
        total=total,
        page=search_params.page,
        page_size=search_params.page_size,
        pages=max((total + search_params.page_size - 1) // search_params.page_size, 1) 
    )
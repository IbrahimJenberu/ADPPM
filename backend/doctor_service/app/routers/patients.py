import uuid
from typing import List, Dict, Any
import logging
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request, status
from app import models, schemas
from app.dependencies import get_db_pool
from fastapi.security import OAuth2PasswordBearer
from app.exceptions import PatientNotFoundException, DatabaseException
from app.services.cardroom_service import get_assigned_patients, get_patient_details
from app.services.auth_service import extract_doctor_from_auth_service

# ←—— THESE THREE IMPORTS NEED TO POINT AT YOUR OWN UTILITY MODULES
from app.services.cardroom_service import get_local_patients
from app.services.cardroom_service import trigger_background_sync

router = APIRouter(prefix="/patients", tags=["patients"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")  # Add OAuth2 scheme

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from app.dependencies import get_db_pool
from app.services.cardroom_service import get_assigned_patients, get_patient_details
import asyncpg
from app.schemas import PatientsListResponse


# Create a logger for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # or DEBUG

# doctor_service/app/routers/patients.py

@router.get("/", response_model=PatientsListResponse)
async def get_assigned_patients_list(
    doctor_id: str = Query(..., description="Doctor ID"),
    force_refresh: bool = Query(False, description="Force refresh from cardroom service"),
    background_sync: bool = Query(True, description="Trigger background sync"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    pool = Depends(get_db_pool)
):
    try:
        # Check if we should force a refresh from cardroom service
        if force_refresh:
            patients = await get_assigned_patients(uuid.UUID(doctor_id), pool)
        else:
            # Try local database first for immediate response
            patients = await get_local_patients(uuid.UUID(doctor_id), pool)
            
            # If no patients in local DB, fetch from cardroom
            if not patients:
                logger.info(f"No patients found locally for doctor {doctor_id}, fetching from cardroom")
                patients = await get_assigned_patients(uuid.UUID(doctor_id), pool)
            elif background_sync:
                # Trigger background sync without waiting or passing request pool
                trigger_background_sync(uuid.UUID(doctor_id))
        
        # Apply pagination
        paginated_patients = patients[skip:skip + limit] if patients else []
        
        return {
            "success": True,
            "patients": paginated_patients,
            "total": len(patients)
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error fetching patients: {str(e)}", exc_info=True)
        raise HTTPException(500, detail=f"Failed to fetch patients: {str(e)}")

@router.get("/{patient_id}/history", response_model=schemas.MedicalRecordsListResponse)
async def get_patient_history(
    patient_id: uuid.UUID = Path(...),
    pool = Depends(get_db_pool)
):
    """Get a patient's medical history."""
    try:
        records = await models.MedicalRecord.get_patient_history(pool, patient_id)
        
        return {
            "success": True,
            "records": records,
            "total": len(records)
        }
        
    except Exception as e:
        raise DatabaseException(detail=f"Failed to get patient history: {str(e)}")

import json

@router.post("/{patient_id}/medical-record", response_model=schemas.MedicalRecordResponse)
async def create_medical_record(
    record_data: schemas.MedicalRecordCreate,
    patient_id: uuid.UUID = Path(...),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
    pool = Depends(get_db_pool),
):
    try:
        # Only verify patient existence
        async with pool.acquire() as conn:
            patient = await conn.fetchrow(
                "SELECT id FROM patients WHERE id = $1 AND is_active = true",
                patient_id
            )
            if not patient:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Patient not found or inactive"
                )

        # Attempt creation without doctor validation
        record = await models.MedicalRecord.create(
            pool=pool,
            patient_id=patient_id,
            doctor_id=doctor_id,
            record_data=record_data.dict()
        )

        return {
            "success": True,
            "message": "Medical record created successfully",
            "record": record
        }

    except asyncpg.ForeignKeyViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid doctor or patient reference"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

# Add to your existing patients.py router

# Updated patients.py router
@router.get("/{patient_id}/medical-records", response_model=schemas.MedicalRecordListResponse)
async def get_medical_records(
    patient_id: uuid.UUID = Path(...),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
    pool = Depends(get_db_pool)
):
    """
    Get all medical records for a patient accessible by the doctor
    """
    try:
        # Verify patient exists
        async with pool.acquire() as conn:
            patient = await conn.fetchrow(
                "SELECT id FROM patients WHERE id = $1 AND is_active = true",
                patient_id
            )
            if not patient:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Patient not found or inactive"
                )

        # Fetch all accessible records
        records = await models.MedicalRecord.get_all_by_patient_doctor(
            pool, patient_id, doctor_id
        )

        return {
            "success": True,
            "message": "Medical records retrieved successfully",
            "records": records
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.get("/{patient_id}/medical-records/{record_id}", response_model=schemas.MedicalRecordResponse)
async def get_medical_record(
    patient_id: uuid.UUID = Path(..., description="ID of the patient"),
    record_id: uuid.UUID = Path(..., description="ID of the medical record to fetch"),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Get a specific medical record by its ID
    """
    try:
        record = await models.MedicalRecord.get_by_id(
            pool, record_id, patient_id, doctor_id
        )
        
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Medical record not found or unauthorized"
            )
            
        return {
            "success": True,
            "message": "Medical record retrieved successfully",
            "record": record
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error retrieving medical record: {str(e)}")
        raise DatabaseException(detail=f"Failed to retrieve medical record: {str(e)}")

@router.patch("/{patient_id}/medical-records/{record_id}", response_model=schemas.MedicalRecordResponse)
async def update_medical_record(
    update_data: schemas.MedicalRecordUpdate,
    record_id: uuid.UUID = Path(..., description="ID of the medical record to update"),
    patient_id: uuid.UUID = Path(..., description="ID of the patient"),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Update an existing medical record for a patient
    """
    try:
        existing_record = await models.MedicalRecord.get_by_id(
            pool, record_id, patient_id, doctor_id
        )
        if not existing_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Medical record not found or unauthorized"
            )

        updated_record = await models.MedicalRecord.update(
            pool, record_id, patient_id, doctor_id, 
            update_data.dict(exclude_unset=True)
        )

        return {
            "success": True,
            "message": "Medical record updated successfully",
            "record": updated_record
        }

    except HTTPException as e:
        raise e
    except asyncpg.ForeignKeyViolationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid patient or doctor reference"
        )
    except Exception as e:
        logging.error(f"Error updating medical record: {str(e)}")
        raise DatabaseException(detail=f"Failed to update medical record: {str(e)}")

# CHANGE TO:
@router.patch("/{patient_id}", response_model=schemas.PatientResponse)
async def update_patient(
    update_data: schemas.PatientUpdate,
    patient_id: uuid.UUID = Path(...),
    pool = Depends(get_db_pool),
):
    try:
        # Convert lists to JSONB
        update_dict = update_data.dict(exclude_unset=True)
        
        if "allergies" in update_dict:
            update_dict["allergies"] = json.dumps(update_dict["allergies"])
            
        if "medical_history" in update_dict:
            update_dict["medical_history"] = json.dumps(update_dict["medical_history"])

        # Get patient first to check if it exists
        async with pool.acquire() as conn:
            patient_exists = await conn.fetchrow(
                "SELECT id FROM patients WHERE id = $1", 
                patient_id
            )
            
            if not patient_exists:
                raise HTTPException(
                    status_code=404,
                    detail="Patient not found"
                )

        # Perform update
        updated_patient = await models.Patient.update_patient(
            pool, patient_id, update_dict
        )
        
        # If result is None, fetch the patient directly
        if updated_patient is None:
            async with pool.acquire() as conn:
                patient_data = await conn.fetchrow(
                    "SELECT * FROM patients WHERE id = $1", 
                    patient_id
                )
                if patient_data:
                    updated_patient = dict(patient_data)

        # Clean up the response - handle missing fields explicitly
        if updated_patient:
            # Ensure required fields have at least null values for Pydantic validation
            if "registration_number" not in updated_patient or updated_patient["registration_number"] is None:
                updated_patient["registration_number"] = "PENDING"  # Provide a default
                
            if "phone_number" not in updated_patient or updated_patient["phone_number"] is None:
                updated_patient["phone_number"] = "UNKNOWN"  # Provide a default
        
        return {
            "success": True,
            "message": "Patient updated successfully",
            "patient": updated_patient
        }
    except HTTPException as e:
        raise e
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=400,
            detail="Registration number must be unique"
        )
    except Exception as e:
        logging.error(f"Update error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

from ..services.timeline_service import get_patient_timeline_fast

@router.get("/{patient_id}/status", response_model=schemas.PatientStatusTimelineResponse)
async def get_patient_status_timeline(
    patient_id: uuid.UUID = Path(..., description="Patient UUID"),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
    pool = Depends(get_db_pool)
):
    """
    High-performance endpoint to get patient status timeline.
    """
    # Use the optimized implementation
    timeline = await get_patient_timeline_fast(pool, patient_id, doctor_id)
    
    return {
        "success": True,
        "message": "Patient status timeline retrieved successfully",
        "timeline": timeline
    }
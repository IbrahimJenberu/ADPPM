#labroom_service/app/routes/lab_requests.py
import uuid
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from datetime import datetime

from ..schemas import (
    LabRequestCreate, 
    LabRequestUpdate, 
    LabRequestResponse, 
    LabRequestDetailResponse,
    StatusResponse,
    PaginatedResponse
)
from ..models import TestStatus, TestPriority, TestType, LabRequest
from ..dependencies import get_lab_request
from ..database import get_connection, insert, update, fetch_one, fetch_all, soft_delete
from ..service.external_services import fetch_patient_details, fetch_doctor_details
from ..notifications import notify_lab_request_assigned, create_notification
from ..exceptions import (
    NotFoundException, 
    BadRequestException, 
    LabRequestAlreadyProcessedException
)

router = APIRouter(prefix="/lab-requests", tags=["Lab Requests"])

@router.post("/", response_model=LabRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_request(
    request_data: LabRequestCreate,
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    Create a new lab test request.
    
    This endpoint is typically called by doctors when they need lab tests for a patient.
    """
    conn = await get_connection()
    
    try:
        # Prepare data for database
        lab_request_data = {
            "patient_id": str(request_data.patient_id),
            "doctor_id": str(request_data.doctor_id),
            "test_type": request_data.test_type.value,
            "priority": request_data.priority.value,
            "status": TestStatus.PENDING.value,
            "notes": request_data.notes,
            "diagnosis_notes": request_data.diagnosis_notes,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        if request_data.due_date:
            lab_request_data["due_date"] = request_data.due_date
        
        # Insert into database
        lab_request_id = await insert("lab_requests", lab_request_data, conn=conn)
        
        # Fetch the created request
        query = "SELECT * FROM lab_requests WHERE id = $1"
        row = await fetch_one(query, lab_request_id, conn=conn)
        
        return LabRequestResponse(**row)
    finally:
        await conn.close()

@router.get("/", response_model=PaginatedResponse)
async def get_lab_requests(
    status: Optional[TestStatus] = None,
    priority: Optional[TestPriority] = None,
    test_type: Optional[TestType] = None,
    patient_id: Optional[uuid.UUID] = None,
    doctor_id: Optional[uuid.UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    Get lab test requests with filtering and pagination.
    
    Lab technicians can see their assigned requests and unassigned ones.
    Admins can see all requests.
    """
    conn = await get_connection()
    
    try:
        # Build query with filters
        query_parts = ["SELECT * FROM lab_requests WHERE is_deleted = FALSE"]
        count_query_parts = ["SELECT COUNT(*) FROM lab_requests WHERE is_deleted = FALSE"]
        params = []
        
        # Filter by status
        if status:
            query_parts.append(f"AND status = ${len(params) + 1}")
            params.append(status.value)
        
        # Filter by priority
        if priority:
            query_parts.append(f"AND priority = ${len(params) + 1}")
            params.append(priority.value)
        
        # Filter by test type
        if test_type:
            query_parts.append(f"AND test_type = ${len(params) + 1}")
            params.append(test_type.value)
        
        # Filter by patient ID
        if patient_id:
            query_parts.append(f"AND patient_id = ${len(params) + 1}")
            params.append(str(patient_id))
        
        # Filter by doctor ID
        if doctor_id:
            query_parts.append(f"AND doctor_id = ${len(params) + 1}")
            params.append(str(doctor_id))
        
        # Filter by date range
        if from_date:
            query_parts.append(f"AND created_at >= ${len(params) + 1}")
            params.append(from_date)
        
        if to_date:
            query_parts.append(f"AND created_at <= ${len(params) + 1}")
            params.append(to_date)
        
        # Filter by technician ID if provided
        if labtechnician_id:
            query_parts.append(f"AND (technician_id = ${len(params) + 1} OR technician_id IS NULL)")
            params.append(str(labtechnician_id))

        # Create count query
        count_query = " ".join(count_query_parts + query_parts[1:])
        
        # Add ordering
        query_parts.append("ORDER BY created_at DESC")
        
        # Add pagination
        offset = (page - 1) * size
        query_parts.append(f"LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}")
        params.extend([size, offset])
        
        # Execute count query
        total = await conn.fetchval(count_query, *params[:-2])
        
        # Execute main query
        query = " ".join(query_parts)
        rows = await fetch_all(query, *params, conn=conn)
        
        # Calculate total pages
        total_pages = (total + size - 1) // size
        
        return {
            "items": rows,
            "total": total,
            "page": page,
            "size": size,
            "pages": total_pages
        }
    finally:
        await conn.close()

from fastapi import Response
from typing import Union

@router.get(
    "/{request_id}",
    response_model=None,  # We'll set this dynamically
    response_model_exclude_none=True  # This removes null fields from response
)
async def get_lab_request_by_id(
    request_id: uuid.UUID = Path(...),
    include_details: bool = Query(False),
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
    response: Response = None
):
    """
    Get a lab test request by ID with optional patient and doctor details.
    """
    # Get lab request without token dependency
    lab_request = await get_lab_request(request_id, labtechnician_id)
    
    # Convert to dict for response
    response_data = lab_request.to_dict()
    
    # Include detailed information if requested
    if include_details:
        conn = await get_connection()
        try:
            # Get patient details - without token (simplified)
            try:
                patient_query = "SELECT * FROM patients WHERE id = $1"
                patient_details = await fetch_one(patient_query, str(lab_request.patient_id), conn=conn)
                if patient_details:
                    response_data["patient_details"] = patient_details
                else:
                    response_data["patient_details"] = {"patient_id": str(lab_request.patient_id), "info": "Basic patient info"}
            except Exception as e:
                response_data["patient_details"] = {"error": str(e)}
            
            # Get doctor details - simplified without token
            try:
                doctor_query = "SELECT * FROM users WHERE id = $1"
                doctor_details = await fetch_one(doctor_query, str(lab_request.doctor_id), conn=conn)
                if doctor_details:
                    response_data["doctor_details"] = doctor_details
                else:
                    response_data["doctor_details"] = {"doctor_id": str(lab_request.doctor_id), "info": "Basic doctor info"}
            except Exception as e:
                response_data["doctor_details"] = {"error": str(e)}
            
            # Get technician details if assigned - simplified
            if lab_request.technician_id:
                try:
                    tech_query = "SELECT * FROM users WHERE id = $1"
                    tech_details = await fetch_one(tech_query, str(lab_request.technician_id), conn=conn)
                    if tech_details:
                        response_data["technician_details"] = tech_details
                    else:
                        response_data["technician_details"] = {"technician_id": str(lab_request.technician_id), "info": "Basic technician info"}
                except Exception:
                    response_data["technician_details"] = None
            
            # Get lab result if available
            result_query = """
            SELECT * FROM lab_results
            WHERE lab_request_id = $1 AND is_deleted = FALSE
            ORDER BY created_at DESC
            LIMIT 1
            """
            
            result_row = await fetch_one(result_query, str(lab_request.id), conn=conn)
            if result_row:
                response_data["lab_result"] = result_row
        finally:
            await conn.close()
        
        # Use detailed response model
        return LabRequestDetailResponse(**response_data)
    else:
        # Use basic response model when details aren't requested
        return LabRequestResponse(**response_data)

@router.patch("/{request_id}", response_model=LabRequestResponse)
async def update_lab_request(
    request_data: LabRequestUpdate,
    request_id: uuid.UUID = Path(...),
    labtechnician_id: uuid.UUID = Query(..., description="Lab Technician ID from frontend"),
):
    """
    Update a lab test request.
    
    Lab technicians can update the status and add notes.
    They can also assign themselves to unassigned requests.
    """
    # Get lab request without token dependency
    lab_request = await get_lab_request(request_id, labtechnician_id)
    
    # Check if request is already completed
    if lab_request.status == TestStatus.COMPLETED and request_data.status != TestStatus.CANCELLED:
        raise LabRequestAlreadyProcessedException(str(request_id))
    
    # Prepare update data
    update_data = request_data.model_dump(exclude_unset=True)
    
    # Convert enums to string values
    if "status" in update_data and update_data["status"]:
        update_data["status"] = update_data["status"].value
        
        # Set completed_at if status is changing to COMPLETED
        if update_data["status"] == TestStatus.COMPLETED.value:
            update_data["completed_at"] = datetime.now()
            
    if "priority" in update_data and update_data["priority"]:
        update_data["priority"] = update_data["priority"].value
    
    # Handle technician assignment
    if "technician_id" in update_data:
        # Simplified: Allow technician to be assigned
        if not update_data["technician_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Technician ID cannot be empty"
            )
        
        # If there was no previous technician and now there is one, create notification
        if not lab_request.technician_id and update_data["technician_id"]:
            conn = await get_connection()
            try:
                # Get patient name for notification - simplified
                patient_name = "Patient"  # Default fallback
                try:
                    patient_query = "SELECT first_name || ' ' || last_name as full_name FROM patients WHERE id = $1"
                    patient_name = await conn.fetchval(patient_query, str(lab_request.patient_id))
                    if not patient_name:
                        patient_name = "Patient"
                except Exception:
                    pass
                
                # Create a notification using local database
                notification_data = {
                    "recipient_id": str(update_data["technician_id"]),
                    "sender_id": str(labtechnician_id),
                    "title": "New Lab Test Assignment",
                    "message": f"You have been assigned a new {lab_request.test_type.value} test for {patient_name}",
                    "notification_type": "lab_request_assigned",
                    "lab_request_id": str(request_id),
                    "is_read": False
                }
                
                await insert("lab_notifications", notification_data, conn=conn)
            except Exception as e:
                # Log error but continue with update
                print(f"Error creating notification: {str(e)}")
            finally:
                await conn.close()
    
    # Perform update
    conn = await get_connection()
    try:
        success = await update("lab_requests", request_id, update_data, conn=conn)
        
        if not success:
            raise BadRequestException("Failed to update lab request")
        
        # Fetch updated request
        query = "SELECT * FROM lab_requests WHERE id = $1"
        updated_row = await fetch_one(query, str(request_id), conn=conn)
        
        return LabRequestResponse(**updated_row)
    finally:
        await conn.close()

@router.delete("/{request_id}", response_model=StatusResponse)
async def delete_lab_request(
    request_id: uuid.UUID = Path(...),
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    Soft delete a lab test request.
    
    Only if it hasn't been completed yet.
    """
    conn = await get_connection()
    
    try:
        # Get the request first
        query = "SELECT * FROM lab_requests WHERE id = $1 AND is_deleted = FALSE"
        row = await fetch_one(query, str(request_id), conn=conn)
        
        if not row:
            raise NotFoundException("Lab request", str(request_id))
        
        # Check if request is already completed
        if row["status"] == TestStatus.COMPLETED.value:
            raise BadRequestException("Cannot delete a completed lab request")
        
        # Perform soft delete
        success = await soft_delete("lab_requests", request_id, conn=conn)
        
        if not success:
            raise BadRequestException("Failed to delete lab request")
        
        return StatusResponse(
            status="success",
            message=f"Lab request {request_id} has been deleted"
        )
    finally:
        await conn.close()

@router.post("/{request_id}/assign", response_model=LabRequestResponse)
async def assign_lab_request(
    request_id: uuid.UUID = Path(...),
    labtechnician_id: uuid.UUID = Query(..., description="Lab Technician ID from frontend"),
):
    """
    Assign a lab test request to the current lab technician.
    
    This is a convenience endpoint for lab technicians to assign themselves to a request.
    """
    # Get lab request without token dependency
    lab_request = await get_lab_request(request_id, labtechnician_id)
    
    # Check if request is already assigned
    if lab_request.technician_id:
        raise BadRequestException("Lab request is already assigned to a technician")
    
    # Prepare update data
    update_data = {
        "technician_id": str(labtechnician_id),
        "status": TestStatus.IN_PROGRESS.value
    }
    
    # Perform update
    conn = await get_connection()
    try:
        success = await update("lab_requests", request_id, update_data, conn=conn)
        
        if not success:
            raise BadRequestException("Failed to assign lab request")
        
        # Create notification about assignment
        try:
            # Get patient name - simplified
            patient_name = "Patient"  # Default fallback
            try:
                patient_query = "SELECT first_name || ' ' || last_name as full_name FROM patients WHERE id = $1"
                patient_name = await conn.fetchval(patient_query, str(lab_request.patient_id))
                if not patient_name:
                    patient_name = "Patient"
            except Exception:
                pass
            
            # Create a notification using local database
            notification_data = {
                "recipient_id": str(lab_request.doctor_id),
                "sender_id": str(labtechnician_id),
                "title": "Lab Request Assigned",
                "message": f"Your lab request for {patient_name} has been assigned and is in progress",
                "notification_type": "lab_request_updated",
                "lab_request_id": str(request_id),
                "is_read": False
            }
            
            await insert("lab_notifications", notification_data, conn=conn)
        except Exception as e:
            # Log error but continue with the update
            print(f"Error creating notification: {str(e)}")
        
        # Fetch updated request
        query = "SELECT * FROM lab_requests WHERE id = $1"
        updated_row = await fetch_one(query, str(request_id), conn=conn)
        
        return LabRequestResponse(**updated_row)
    finally:
        await conn.close()
        
# Add to labroom_service/app/routes/lab_requests.py

@router.get("/debug/recent-requests", tags=["debug"])
async def get_recent_lab_requests(limit: int = 10):
    """Debug endpoint to view the most recent lab requests."""
    conn = await get_connection()
    
    try:
        query = """
        SELECT * FROM lab_requests 
        ORDER BY created_at DESC 
        LIMIT $1
        """
        
        rows = await conn.fetch(query, limit)
        
        # Convert rows to dictionaries
        requests = []
        for row in rows:
            request_dict = dict(row)
            # Convert datetime objects to strings for JSON serialization
            for key, value in request_dict.items():
                if isinstance(value, datetime):
                    request_dict[key] = value.isoformat()
            requests.append(request_dict)
            
        return {"requests": requests}
    finally:
        await conn.close()
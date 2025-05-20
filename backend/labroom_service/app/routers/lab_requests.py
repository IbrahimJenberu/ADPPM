import uuid
import asyncio
import logging
import json
import time
from typing import Dict, List, Any, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status, Response, Request
from datetime import datetime, timedelta
from fastapi.responses import JSONResponse
from cachetools import TTLCache, cached

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

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize cache with 5 minute TTL and max 1000 items
request_cache = TTLCache(maxsize=1000, ttl=300)
detail_cache = TTLCache(maxsize=500, ttl=180)

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
        
        # Invalidate any relevant cache entries
        if hasattr(request_cache, 'cache_clear'):
            request_cache.cache_clear()
        
        return LabRequestResponse(**row)
    finally:
        await conn.close()

@router.get("/", response_model=PaginatedResponse)
async def get_lab_requests(
    request: Request,
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
    cursor: Optional[str] = Query(None, description="Cursor for pagination"),
):
    """
    Get lab test requests with filtering and pagination.
    
    Lab technicians can see their assigned requests and unassigned ones.
    Admins can see all requests.
    """
    # Generate cache key based on all parameters
    cache_key = f"{status}_{priority}_{test_type}_{patient_id}_{doctor_id}_{from_date}_{to_date}_{page}_{size}_{labtechnician_id}_{cursor}"
    
    # Check cache first
    if cache_key in request_cache:
        logger.info("Returning lab requests from cache")
        return request_cache[cache_key]
    
    # Create database connection
    conn = await get_connection()
    
    try:
        # Start timer for performance tracking
        start_time = time.time()
        
        # Use more efficient common table expression (CTE) query
        query_parts = []
        params = []
        
        # Begin the CTE for filtering
        cte_query = """
        WITH filtered_requests AS (
            SELECT 
                lr.*,
                COUNT(*) OVER() as total_count
            FROM lab_requests lr
            WHERE is_deleted = FALSE
        """
        
        # Add filter conditions
        if status:
            cte_query += f" AND status = ${len(params) + 1}"
            params.append(status.value)
        
        if priority:
            cte_query += f" AND priority = ${len(params) + 1}"
            params.append(priority.value)
        
        if test_type:
            cte_query += f" AND test_type = ${len(params) + 1}"
            params.append(test_type.value)
        
        if patient_id:
            cte_query += f" AND patient_id = ${len(params) + 1}"
            params.append(str(patient_id))
        
        if doctor_id:
            cte_query += f" AND doctor_id = ${len(params) + 1}"
            params.append(str(doctor_id))
        
        if from_date:
            cte_query += f" AND created_at >= ${len(params) + 1}"
            params.append(from_date)
        
        if to_date:
            cte_query += f" AND created_at <= ${len(params) + 1}"
            params.append(to_date)
        
        if labtechnician_id:
            cte_query += f" AND (technician_id = ${len(params) + 1} OR technician_id IS NULL)"
            params.append(str(labtechnician_id))
        
        # Close the CTE definition and prepare the main query
        cte_query += ")"
        
        # Implement cursor-based pagination if cursor is provided, otherwise use offset pagination
        if cursor:
            try:
                # Decode cursor which is formatted as "{timestamp}_{id}"
                cursor_parts = cursor.split('_')
                if len(cursor_parts) != 2:
                    raise ValueError("Invalid cursor format")
                
                cursor_timestamp = datetime.fromisoformat(cursor_parts[0])
                cursor_id = cursor_parts[1]
                
                main_query = f"""
                SELECT * FROM filtered_requests
                WHERE (created_at, id) < (${len(params) + 1}, ${len(params) + 2})
                ORDER BY created_at DESC, id DESC
                LIMIT ${len(params) + 3}
                """
                params.extend([cursor_timestamp, cursor_id, size])
            except (ValueError, IndexError):
                # If cursor is invalid, fall back to offset pagination
                main_query = f"""
                SELECT * FROM filtered_requests
                ORDER BY created_at DESC, id DESC
                LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
                """
                offset = (page - 1) * size
                params.extend([size, offset])
        else:
            # Use traditional offset pagination
            main_query = f"""
            SELECT * FROM filtered_requests
            ORDER BY created_at DESC, id DESC
            LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
            """
            offset = (page - 1) * size
            params.extend([size, offset])
        
        # Combine the CTE with the main query
        full_query = cte_query + "\n" + main_query
        
        # Execute the optimized query
        rows = await conn.fetch(full_query, *params)
        
        # Extract the total count from the first row, or 0 if no rows
        total = rows[0]['total_count'] if rows else 0
        
        # Convert rows to dictionaries
        results = []
        for row in rows:
            result_dict = dict(row)
            # Remove the total_count field from the result
            if 'total_count' in result_dict:
                del result_dict['total_count']
            results.append(result_dict)
        
        # Generate next cursor for cursor-based pagination
        next_cursor = None
        if results and len(results) == size:  # If we have a full page
            last_item = results[-1]
            next_cursor = f"{last_item['created_at'].isoformat()}_{last_item['id']}"
        
        # Calculate total pages for offset pagination
        total_pages = (total + size - 1) // size if total > 0 else 1
        
        # Prepare the response
        response = {
            "items": results,
            "total": total,
            "page": page,
            "size": size,
            "pages": total_pages
        }
        
        # Add cursor info if using cursor-based pagination
        if cursor or next_cursor:
            response["next_cursor"] = next_cursor
            response["current_cursor"] = cursor
        
        # Log the query execution time
        execution_time = time.time() - start_time
        logger.info(f"Lab requests query executed in {execution_time:.4f} seconds")
        
        # Cache the results
        request_cache[cache_key] = response
        
        return response
    except Exception as e:
        logger.error(f"Error fetching lab requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching lab requests: {str(e)}"
        )
    finally:
        await conn.close()

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
    # Generate cache key
    cache_key = f"{request_id}_{include_details}_{labtechnician_id}"
    
    # Check if in cache first
    if cache_key in detail_cache:
        logger.info("Returning lab request details from cache")
        return detail_cache[cache_key]
    
    # Get lab request without token dependency
    lab_request = await get_lab_request(request_id, labtechnician_id)
    
    # Convert to dict for response
    response_data = lab_request.to_dict()
    
    # Include detailed information if requested
    if include_details:
        conn = await get_connection()
        try:
            # Prepare the coroutines for parallel execution
            tasks = []
            
            # Prepare patient details query
            patient_task = asyncio.create_task(_get_patient_details(conn, lab_request.patient_id))
            tasks.append(("patient_details", patient_task))
            
            # Prepare doctor details query
            doctor_task = asyncio.create_task(_get_doctor_details(conn, lab_request.doctor_id))
            tasks.append(("doctor_details", doctor_task))
            
            # Prepare technician details query if assigned
            if lab_request.technician_id:
                tech_task = asyncio.create_task(_get_technician_details(conn, lab_request.technician_id))
                tasks.append(("technician_details", tech_task))
            
            # Prepare lab result query
            result_task = asyncio.create_task(_get_lab_result(conn, lab_request.id))
            tasks.append(("lab_result", result_task))
            
            # Execute all queries in parallel
            for key, task in tasks:
                response_data[key] = await task
            
        finally:
            await conn.close()
        
        # Cache the result
        detail_cache[cache_key] = LabRequestDetailResponse(**response_data)
        return LabRequestDetailResponse(**response_data)
    else:
        # Use basic response model when details aren't requested
        result = LabRequestResponse(**response_data)
        detail_cache[cache_key] = result
        return result

# Helper functions for parallel data fetching
async def _get_patient_details(conn, patient_id):
    try:
        patient_query = """
        SELECT * FROM patients WHERE id = $1
        """
        patient_details = await fetch_one(patient_query, str(patient_id), conn=conn)
        if patient_details:
            return patient_details
        else:
            return {"patient_id": str(patient_id), "info": "Basic patient info"}
    except Exception as e:
        logger.error(f"Error fetching patient details: {str(e)}")
        return {"error": str(e)}

async def _get_doctor_details(conn, doctor_id):
    try:
        doctor_query = """
        SELECT * FROM users WHERE id = $1
        """
        doctor_details = await fetch_one(doctor_query, str(doctor_id), conn=conn)
        if doctor_details:
            return doctor_details
        else:
            return {"doctor_id": str(doctor_id), "info": "Basic doctor info"}
    except Exception as e:
        logger.error(f"Error fetching doctor details: {str(e)}")
        return {"error": str(e)}

async def _get_technician_details(conn, technician_id):
    try:
        tech_query = """
        SELECT * FROM users WHERE id = $1
        """
        tech_details = await fetch_one(tech_query, str(technician_id), conn=conn)
        if tech_details:
            return tech_details
        else:
            return {"technician_id": str(technician_id), "info": "Basic technician info"}
    except Exception as e:
        logger.error(f"Error fetching technician details: {str(e)}")
        return {"error": str(e)}

async def _get_lab_result(conn, lab_request_id):
    try:
        result_query = """
        SELECT * FROM lab_results
        WHERE lab_request_id = $1 AND is_deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1
        """
        
        result_row = await fetch_one(result_query, str(lab_request_id), conn=conn)
        return result_row
    except Exception as e:
        logger.error(f"Error fetching lab result: {str(e)}")
        return None

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
                logger.error(f"Error creating notification: {str(e)}")
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
        
        # Clear caches
        if hasattr(request_cache, 'cache_clear'):
            request_cache.cache_clear()
        if hasattr(detail_cache, 'cache_clear'):
            detail_cache.cache_clear()
        
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
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

# Initialize cache with 10 minute TTL and max 2000 items
request_cache = TTLCache(maxsize=2000, ttl=600)
detail_cache = TTLCache(maxsize=1000, ttl=300)

# Create a connection pool specifically for lab requests
lab_request_pool = None

async def init_lab_request_pool():
    """Initialize a dedicated connection pool for lab requests"""
    global lab_request_pool
    from ..config import settings
    import asyncpg
    
    if not lab_request_pool:
        try:
            lab_request_pool = await asyncpg.create_pool(
                dsn=settings.DATABASE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60,
            )
            
            # Set optimal PostgreSQL connection settings
            if lab_request_pool:
                async with lab_request_pool.acquire() as conn:
                    # Set work_mem for complex sorting operations
                    await conn.execute("SET work_mem = '10MB'")
                    # Use indexes aggressively
                    await conn.execute("SET random_page_cost = 1.1")
                    
            logger.info("Lab request pool initialized successfully")
            return lab_request_pool
        except Exception as e:
            logger.error(f"Error initializing lab request pool: {str(e)}")
            # Fall back to the default connection
            return None
    
    return lab_request_pool

async def get_lab_request_connection():
    """Get a connection from the lab request pool or fall back to default"""
    pool = await init_lab_request_pool()
    if pool:
        return await pool.acquire()
    else:
        # Fall back to default connection
        return await get_connection()

async def release_lab_request_connection(conn):
    """Release a connection back to the pool"""
    if lab_request_pool and conn:
        try:
            await lab_request_pool.release(conn)
        except Exception as e:
            logger.error(f"Error releasing connection: {str(e)}")

async def create_optimized_indexes():
    """Create optimized indexes for lab requests queries"""
    conn = await get_connection()
    try:
        # Add these highly optimized indexes
        index_queries = [
            # Composite index for core filters
            """
            CREATE INDEX IF NOT EXISTS idx_lab_requests_optimized ON lab_requests 
            (status, priority, test_type, created_at DESC) 
            WHERE is_deleted = FALSE
            """,
            
            # Index for tech assignment queries
            """
            CREATE INDEX IF NOT EXISTS idx_lab_requests_technician ON lab_requests 
            (technician_id, created_at DESC) 
            WHERE is_deleted = FALSE
            """,
            
            # Index for cursor pagination
            """
            CREATE INDEX IF NOT EXISTS idx_lab_requests_created_id ON lab_requests 
            (created_at DESC, id DESC) 
            WHERE is_deleted = FALSE
            """,
            
            # Index for lab results queries
            """
            CREATE INDEX IF NOT EXISTS idx_lab_results_request ON lab_results
            (lab_request_id, created_at DESC)
            WHERE is_deleted = FALSE
            """
        ]
        
        # Execute all index creation queries
        for query in index_queries:
            try:
                await conn.execute(query)
            except Exception as e:
                logger.warning(f"Index creation query failed: {str(e)}")
            
        logger.info("Created optimized indexes for lab requests")
    except Exception as e:
        logger.error(f"Error creating optimized indexes: {str(e)}")
    finally:
        await conn.close()

# These functions must be registered in main.py with app.on_event("startup")
async def startup_event():
    """Initialize the lab request module"""
    await init_lab_request_pool()
    await create_optimized_indexes()

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
        request_cache.clear()
        
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
    # Generate cache key based on query parameters
    cache_key = f"{status}_{priority}_{test_type}_{patient_id}_{doctor_id}_{from_date}_{to_date}_{page}_{size}_{labtechnician_id}_{cursor}"
    
    # Check cache first
    if cache_key in request_cache:
        logger.info("Returning lab requests from cache")
        return request_cache[cache_key]
    
    # Use the dedicated connection pool
    conn = await get_lab_request_connection()
    
    try:
        # Start timer for performance tracking
        start_time = time.time()
        
        # Determine if we need to count the total results (expensive operation)
        need_count = page == 1 and not cursor  # Only count on first page of regular pagination
        
        # Build query for optimal performance
        query_parts = []
        count_query_parts = []
        params = []
        
        # PART 1: Use a more efficient query structure
        base_query = """
        SELECT 
            lr.id,
            lr.patient_id,
            lr.doctor_id,
            lr.technician_id,
            lr.test_type,
            lr.priority,
            lr.status,
            lr.notes,
            lr.diagnosis_notes,
            lr.created_at,
            lr.updated_at,
            lr.completed_at,
            lr.due_date,
            lr.is_read,
            lr.read_at
        FROM lab_requests lr
        WHERE lr.is_deleted = FALSE
        """
        
        # Add filter conditions
        filter_conditions = []
        param_index = 1
        
        if status:
            filter_conditions.append(f"lr.status = ${param_index}")
            params.append(status.value)
            param_index += 1
        
        if priority:
            filter_conditions.append(f"lr.priority = ${param_index}")
            params.append(priority.value)
            param_index += 1
        
        if test_type:
            filter_conditions.append(f"lr.test_type = ${param_index}")
            params.append(test_type.value)
            param_index += 1
        
        if patient_id:
            filter_conditions.append(f"lr.patient_id = ${param_index}")
            params.append(str(patient_id))
            param_index += 1
        
        if doctor_id:
            filter_conditions.append(f"lr.doctor_id = ${param_index}")
            params.append(str(doctor_id))
            param_index += 1
        
        if from_date:
            filter_conditions.append(f"lr.created_at >= ${param_index}")
            params.append(from_date)
            param_index += 1
        
        if to_date:
            filter_conditions.append(f"lr.created_at <= ${param_index}")
            params.append(to_date)
            param_index += 1
        
        if labtechnician_id:
            filter_conditions.append(f"(lr.technician_id = ${param_index} OR lr.technician_id IS NULL)")
            params.append(str(labtechnician_id))
            param_index += 1
        
        # Add filter conditions to base query if any exist
        if filter_conditions:
            base_query += " AND " + " AND ".join(filter_conditions)
        
        # Add count query if needed
        count_query = ""
        if need_count:
            count_query = f"SELECT COUNT(*) FROM lab_requests lr WHERE lr.is_deleted = FALSE"
            if filter_conditions:
                count_query += " AND " + " AND ".join(filter_conditions)
        
        # Add ordering and limit for main query
        main_query = base_query + " ORDER BY lr.created_at DESC, lr.id DESC"
        
        # Add pagination
        if cursor:
            # Parse cursor which contains the timestamp and ID of the last item
            try:
                cursor_parts = cursor.split('_')
                if len(cursor_parts) != 2:
                    raise ValueError("Invalid cursor format")
                
                cursor_timestamp = datetime.fromisoformat(cursor_parts[0])
                cursor_id = cursor_parts[1]
                
                # Add cursor condition
                main_query += f" WHERE (lr.created_at, lr.id) < (${param_index}, ${param_index + 1})"
                params.extend([cursor_timestamp, cursor_id])
                param_index += 2
                
                # Add limit
                main_query += f" LIMIT ${param_index}"
                params.append(size)
            except Exception as e:
                logger.error(f"Invalid cursor: {str(e)}")
                # Fall back to offset pagination
                offset = (page - 1) * size
                main_query += f" LIMIT ${param_index} OFFSET ${param_index + 1}"
                params.extend([size, offset])
        else:
            # Use offset pagination
            offset = (page - 1) * size
            main_query += f" LIMIT ${param_index} OFFSET ${param_index + 1}"
            params.extend([size, offset])
        
        # Execute the query with appropriate timeout
        try:
            # First get the count if needed
            total = 0
            if need_count:
                try:
                    total = await conn.fetchval(count_query, *params[:-2])
                except Exception as e:
                    logger.error(f"Count query failed: {str(e)}")
                    # Estimate total to avoid query failure
                    total = size * page * 2  # Just an approximation
            
            # Execute main query to get the data
            rows = await conn.fetch(main_query, *params, timeout=10.0)
        except asyncio.TimeoutError:
            logger.error("Query execution timed out, trying fallback query")
            # Fallback to simpler, faster query if timeout occurs
            fallback_query = """
            SELECT * FROM lab_requests 
            WHERE is_deleted = FALSE 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
            """
            rows = await conn.fetch(fallback_query, size, (page-1)*size)
            total = await conn.fetchval("SELECT COUNT(*) FROM lab_requests WHERE is_deleted = FALSE")
        except Exception as e:
            logger.error(f"Query execution error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail="Database query failed"
            )
            
        # Process results
        results = [dict(row) for row in rows]
        
        # If we didn't get a total count from the query, use a default
        if not total and not cursor:
            # This is an approximation to avoid an expensive COUNT(*) query
            total = len(results) + ((page - 1) * size)
        
        # Generate next cursor for cursor-based pagination
        next_cursor = None
        if results and len(results) == size:  # If we have a full page
            last_item = results[-1]
            next_cursor = f"{last_item['created_at'].isoformat()}_{last_item['id']}"
        
        # Calculate total pages
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
        
        # Only cache if query was reasonably fast
        if execution_time < 5.0:
            request_cache[cache_key] = response
        
        return response
    except Exception as e:
        logger.error(f"Error fetching lab requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching lab requests: {str(e)}"
        )
    finally:
        await release_lab_request_connection(conn)

# Add a fast emergency endpoint to get lab requests without any filtering
@router.get("/fast", response_model=List[Dict[str, Any]])
async def get_lab_requests_fast(
    limit: int = Query(50, le=500),
    labtechnician_id: Optional[uuid.UUID] = Query(None)
):
    """
    Get lab requests with minimal processing for emergency situations.
    This endpoint bypasses most filters and pagination for maximum speed.
    """
    cache_key = f"fast_{limit}_{labtechnician_id}"
    
    # Check cache first
    if cache_key in request_cache:
        logger.info("Returning fast lab requests from cache")
        return request_cache[cache_key]
    
    conn = await get_lab_request_connection()
    try:
        start_time = time.time()
        
        # Super optimized query with minimal filtering
        query = """
        SELECT lr.id, lr.patient_id, lr.doctor_id, lr.test_type, lr.priority, 
               lr.status, lr.created_at, lr.updated_at
        FROM lab_requests lr
        WHERE lr.is_deleted = FALSE
        """
        
        params = []
        if labtechnician_id:
            query += " AND (lr.technician_id = $1 OR lr.technician_id IS NULL)"
            params.append(str(labtechnician_id))
        
        # Add order and limit
        query += "\nORDER BY lr.created_at DESC LIMIT $" + str(len(params) + 1)
        params.append(limit)
        
        # Execute with short timeout
        rows = await conn.fetch(query, *params, timeout=5.0)
        results = [dict(row) for row in rows]
        
        execution_time = time.time() - start_time
        logger.info(f"Fast lab requests query executed in {execution_time:.4f} seconds")
        
        # Cache results
        request_cache[cache_key] = results
        
        return results
    except Exception as e:
        logger.error(f"Error in fast fetch: {str(e)}")
        # Fallback to super minimal query
        try:
            minimal_query = "SELECT * FROM lab_requests WHERE is_deleted = FALSE ORDER BY created_at DESC LIMIT $1"
            rows = await conn.fetch(minimal_query, limit)
            return [dict(row) for row in rows]
        except Exception as fallback_error:
            logger.error(f"Fallback query failed: {str(fallback_error)}")
            return []
    finally:
        await release_lab_request_connection(conn)

@router.get(
    "/{request_id}",
    response_model=None,
    response_model_exclude_none=True
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
    
    # Start timing
    start_time = time.time()
    
    # Use try-except to handle errors gracefully
    try:
        # Get lab request
        lab_request = await get_lab_request(request_id, labtechnician_id)
        
        # Convert to dict for response
        response_data = lab_request.to_dict()
        
        # Include detailed information if requested
        if include_details:
            conn = await get_lab_request_connection()
            try:
                # Execute the fallback queries in parallel
                tasks = []
                
                # Prepare patient details query
                async def get_patient():
                    try:
                        patient_query = "SELECT * FROM patients WHERE id = $1"
                        return await fetch_one(patient_query, str(lab_request.patient_id), conn=conn)
                    except Exception as e:
                        logger.error(f"Error fetching patient: {e}")
                        return {"patient_id": str(lab_request.patient_id), "info": "Basic patient info"}
                
                tasks.append(("patient_details", asyncio.create_task(get_patient())))
                
                # Prepare doctor details query
                async def get_doctor():
                    try:
                        doctor_query = "SELECT * FROM users WHERE id = $1"
                        return await fetch_one(doctor_query, str(lab_request.doctor_id), conn=conn)
                    except Exception as e:
                        logger.error(f"Error fetching doctor: {e}")
                        return {"doctor_id": str(lab_request.doctor_id), "info": "Basic doctor info"}
                
                tasks.append(("doctor_details", asyncio.create_task(get_doctor())))
                
                # Prepare technician details query if assigned
                if lab_request.technician_id:
                    async def get_technician():
                        try:
                            tech_query = "SELECT * FROM users WHERE id = $1"
                            return await fetch_one(tech_query, str(lab_request.technician_id), conn=conn)
                        except Exception as e:
                            logger.error(f"Error fetching technician: {e}")
                            return {"technician_id": str(lab_request.technician_id), "info": "Basic technician info"}
                    
                    tasks.append(("technician_details", asyncio.create_task(get_technician())))
                
                # Prepare lab result query
                async def get_result():
                    try:
                        result_query = """
                        SELECT * FROM lab_results
                        WHERE lab_request_id = $1 AND is_deleted = FALSE
                        ORDER BY created_at DESC
                        LIMIT 1
                        """
                        return await fetch_one(result_query, str(lab_request.id), conn=conn)
                    except Exception as e:
                        logger.error(f"Error fetching lab result: {e}")
                        return None
                
                tasks.append(("lab_result", asyncio.create_task(get_result())))
                
                # Execute all queries in parallel
                for key, task in tasks:
                    try:
                        response_data[key] = await task
                    except Exception as e:
                        logger.error(f"Task error for {key}: {e}")
                        # Provide fallback values for critical fields
                        if key == "patient_details":
                            response_data[key] = {"patient_id": str(lab_request.patient_id), "info": "Basic patient info"}
                        elif key == "doctor_details":
                            response_data[key] = {"doctor_id": str(lab_request.doctor_id), "info": "Basic doctor info"}
            
            finally:
                await release_lab_request_connection(conn)
            
            # Create response with detailed model
            result = LabRequestDetailResponse(**response_data)
        else:
            # Use basic response model when details aren't requested
            result = LabRequestResponse(**response_data)
        
        # Record execution time
        execution_time = time.time() - start_time
        logger.info(f"Lab request detail query executed in {execution_time:.4f} seconds")
        
        # Cache the result if it was reasonably fast
        if execution_time < 3.0:
            detail_cache[cache_key] = result
        
        return result
    except Exception as e:
        logger.error(f"Error fetching lab request details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching lab request details: {str(e)}"
        )

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
        request_cache.clear()
        detail_cache.clear()
        
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
        
        # Clear caches
        request_cache.clear()
        detail_cache.clear()
        
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
            logger.error(f"Error creating notification: {str(e)}")
        
        # Fetch updated request
        query = "SELECT * FROM lab_requests WHERE id = $1"
        updated_row = await fetch_one(query, str(request_id), conn=conn)
        
        # Clear caches
        request_cache.clear()
        detail_cache.clear()
        
        return LabRequestResponse(**updated_row)
    finally:
        await conn.close()

# Don't update the update/patch/delete methods - they are not performance-critical

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
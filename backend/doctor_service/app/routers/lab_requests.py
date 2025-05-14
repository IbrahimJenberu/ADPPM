#doctor_service/app/routes/lab_requests.py
import uuid
import json
import asyncio
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
import logging
from app import models, schemas
from app.dependencies import get_db_pool, get_current_doctor, validate_doctor_patient_access
from app.exceptions import PatientNotFoundException, LabRequestNotFoundException, DatabaseException
from app.notifications import create_notification_for_role, create_notification
from app.utils.email import send_email
from app.utils.storage import save_file_to_storage, get_file_url
from app.utils.lab_service import create_lab_request_in_lab_service

router = APIRouter(prefix="/lab-requests", tags=["lab requests"])

# Constants
LAB_REQUEST_STATUSES = ["pending", "in_progress", "completed", "cancelled", "rejected"]
LAB_REQUEST_PRIORITIES = ["routine", "urgent", "stat"]  # stat is higher priority than urgent
ALLOWED_LAB_RESULT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/msword", 
                               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]

# Add a new helper function to initialize the WebSocket connection
async def initialize_lab_ws_connection(doctor_id: str):
    """Initialize WebSocket connection to lab service for lab requests."""
    from app.utils.lab_request_ws_client import set_doctor_id, get_ws_connection
    
    # Set the doctor ID
    set_doctor_id(doctor_id)
    
    # Create the connection in the background
    asyncio.create_task(get_ws_connection())

# ==== CREATE LAB REQUEST ====
@router.post("/", response_model=schemas.LabRequestResponse)
async def create_lab_request(
    request_data: schemas.LabRequestCreate,
    background_tasks: BackgroundTasks,
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Create a new lab test request."""
    
    # Initialize WebSocket connection for this doctor
    background_tasks.add_task(initialize_lab_ws_connection, str(doctor_id))
    
    try:
        # Simply get the patient info without validation
        async with pool.acquire() as conn:
            patient_query = """
                SELECT first_name, last_name
                FROM patients
                WHERE id = $1 AND is_active = true
            """
            patient_record = await conn.fetchrow(patient_query, request_data.patient_id)
            
            if not patient_record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Patient not found"
                )
            
            patient = dict(patient_record)
            # Extract patient name
            patient_name = f"{patient_record['first_name']} {patient_record['last_name']}"
            # Get doctor's name
            doctor_query = "SELECT full_name FROM users WHERE id = $1 AND role = 'doctor'"
            doctor_name = await conn.fetchval(doctor_query, doctor_id)
            
            # Create lab request directly
            request_id = uuid.uuid4()
            
            lab_request_query = """
                INSERT INTO lab_requests 
                    (id, patient_id, doctor_id, test_type, urgency, notes, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                RETURNING *;
            """
            
            record = await conn.fetchrow(
                lab_request_query, 
                request_id,
                request_data.patient_id, 
                doctor_id, 
                request_data.test_type, 
                request_data.urgency, 
                request_data.notes
            )
            
            # Convert record to dict, ensuring UUIDs are strings
            lab_request = {}
            for key, value in dict(record).items():
                if isinstance(value, uuid.UUID):
                    lab_request[key] = str(value)
                elif isinstance(value, datetime):
                    lab_request[key] = value.isoformat()
                else:
                    lab_request[key] = value
            
            # Enhanced notification with patient details and urgency level
            notification_title = f"New {request_data.urgency.upper()} Lab Request"
            notification_content = (
                f"Dr. {doctor_name or 'Unknown'} has requested a {request_data.test_type} test "
                f"for patient {patient.get('first_name', '')} {patient.get('last_name', '')} "
                f"with {request_data.urgency} urgency."
            )
            
            # Directly create the notification in the database
            notification_id = uuid.uuid4()
            
            # Find lab technicians
            lab_techs_query = """
                SELECT id FROM users
                WHERE role = 'lab_technician' AND is_active = true
            """
            
            lab_techs = await conn.fetch(lab_techs_query)
            
            # Create notification for each lab technician
            for tech in lab_techs:
                tech_id = tech['id']
                notif_query = """
                    INSERT INTO notifications (
                        id, recipient_id, message, notification_type, entity_id, is_read
                    )
                    VALUES ($1, $2, $3, $4, $5, false)
                """
                
                await conn.execute(
                    notif_query,
                    uuid.uuid4(),  # unique ID for each notification
                    tech_id,
                    f"{notification_title}: {notification_content}",
                    "new_lab_request",
                    request_id
                )
                
                # If urgent, also queue email
                if request_data.urgency in ["urgent", "stat"]:
                    # Get tech email
                    email_query = "SELECT email FROM users WHERE id = $1"
                    tech_email = await conn.fetchval(email_query, tech_id)
                    
                    if tech_email:
                        background_tasks.add_task(
                            send_email,
                            recipient=tech_email,
                            subject=notification_title,
                            content=f"{notification_content}\n\nPlease log in to the system to process this request."
                        )
            
            # Synchronize the lab request with the lab service
            # Add this to background tasks to avoid blocking the doctor's workflow
            background_tasks.add_task(
                sync_lab_request_with_lab_service,
                lab_request=lab_request,
                patient_name=patient_name,
                doctor_name=doctor_name
            )
        
        return {
            "success": True,
            "message": f"Lab request created successfully with {request_data.urgency} priority",
            "lab_request": lab_request
        }
    except HTTPException:
        raise
    except Exception as e:
        # Detailed error for debugging
        import traceback
        error_details = f"Failed to create lab request: {str(e)}\n{traceback.format_exc()}"
        logging.error(error_details)
        raise DatabaseException(detail=f"Failed to create lab request: {str(e)}")

# Add a helper function to handle the lab service synchronization
async def sync_lab_request_with_lab_service(
    lab_request: Dict[str, Any],
    patient_name: str,
    doctor_name: str
):
    """Helper function to synchronize lab request with lab service."""
    try:
        # Convert datetime objects to ISO format strings
        created_at = None
        if "created_at" in lab_request:
            if isinstance(lab_request["created_at"], datetime):
                created_at = lab_request["created_at"].isoformat()
            else:
                created_at = lab_request["created_at"]
        else:
            created_at = datetime.now().isoformat()
            
        # Map the urgency field to priority for the lab service
        # The lab service uses 'priority' while doctor service uses 'urgency'
        lab_request_data = {
            "id": lab_request["id"],
            "patient_id": lab_request["patient_id"],
            "doctor_id": lab_request["doctor_id"],
            "test_type": lab_request["test_type"],
            "urgency": lab_request["urgency"],  # Keep original field
            "priority": lab_request["urgency"],  # Add mapped field
            "status": lab_request["status"],
            "notes": lab_request["notes"],
            "diagnosis_notes": "",  # Optional in lab service
            "created_at": created_at,  # Now consistently an ISO format string
            "patient_name": patient_name,  # Additional context
            "doctor_name": doctor_name     # Additional context
        }
        
        # Call the lab service to create/update the lab request with retry logic
        success = await create_lab_request_in_lab_service(lab_request_data)
        
        if not success:
            logging.error(f"Failed to synchronize lab request {lab_request['id']} with lab service")
        else:
            logging.info(f"Successfully synchronized lab request {lab_request['id']} with lab service")
            
    except Exception as e:
        logging.error(f"Error synchronizing lab request with lab service: {str(e)}")
        # Don't raise the exception - we don't want to affect the doctor's workflow

# ==== GET LAB REQUESTS LIST ====
@router.get("/", response_model=schemas.LabRequestsListResponse)
async def get_lab_requests(
    status: Optional[str] = Query(None, description="Filter by status (pending, in_progress, completed, cancelled, rejected)"),
    urgency: Optional[str] = Query(None, description="Filter by urgency (routine, urgent, stat)"),
    test_type: Optional[str] = Query(None, description="Filter by test type"),
    patient_id: Optional[uuid.UUID] = Query(None, description="Filter by patient ID"),
    patient_name: Optional[str] = Query(None, description="Search by patient name"),
    date_from: Optional[date] = Query(None, description="Filter by request date (from)"),
    date_to: Optional[date] = Query(None, description="Filter by request date (to)"),
    sort_by: str = Query("created_at", description="Sort by field (created_at, urgency, test_type, status)"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Get all lab requests created by the doctor with advanced filtering and sorting."""
    try:
        # Validate sort and filter parameters
        if status and status not in LAB_REQUEST_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Invalid status. Must be one of: {', '.join(LAB_REQUEST_STATUSES)}"
            )
            
        if urgency and urgency not in LAB_REQUEST_PRIORITIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid urgency. Must be one of: {', '.join(LAB_REQUEST_PRIORITIES)}"
            )
            
        if sort_by not in ["created_at", "urgency", "test_type", "status"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid sort_by parameter. Must be one of: created_at, urgency, test_type, status"
            )
            
        if sort_order not in ["asc", "desc"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid sort_order parameter. Must be one of: asc, desc"
            )
        
        # Build query with filters
        query = """
            SELECT lr.*, 
                   p.first_name || ' ' || p.last_name as patient_name,
                   u.full_name as doctor_name,
                   COALESCE(array_length(lr_files.file_ids, 1), 0) as file_count
            FROM lab_requests lr
            JOIN patients p ON lr.patient_id = p.id
            JOIN users u ON lr.doctor_id = u.id
            LEFT JOIN (
                SELECT lab_request_id, array_agg(id) as file_ids
                FROM lab_request_files
                GROUP BY lab_request_id
            ) lr_files ON lr.id = lr_files.lab_request_id
            WHERE lr.doctor_id = $1 AND lr.is_active = true
        """
        
        params = [doctor_id]
        param_index = 2
        
        # Add filters to query
        if status:
            query += f" AND lr.status = ${param_index}"
            params.append(status)
            param_index += 1
            
        if urgency:
            query += f" AND lr.urgency = ${param_index}"
            params.append(urgency)
            param_index += 1
            
        if test_type:
            query += f" AND lr.test_type = ${param_index}"
            params.append(test_type)
            param_index += 1
            
        if patient_id:
            query += f" AND lr.patient_id = ${param_index}"
            params.append(patient_id)
            param_index += 1
            
        if patient_name:
            query += f" AND (p.first_name ILIKE ${param_index} OR p.last_name ILIKE ${param_index})"
            params.append(f"%{patient_name}%")
            param_index += 1
            
        if date_from:
            query += f" AND DATE(lr.created_at) >= ${param_index}"
            params.append(date_from)
            param_index += 1
            
        if date_to:
            query += f" AND DATE(lr.created_at) <= ${param_index}"
            params.append(date_to)
            param_index += 1
            
        # Add count query for pagination
        count_query = f"""
            SELECT COUNT(*)
            FROM ({query}) as filtered_requests
        """
        
        # Add sorting and pagination
        query += f" ORDER BY lr.{sort_by} {sort_order.upper()}"
        query += f" LIMIT ${param_index} OFFSET ${param_index + 1}"
        params.extend([limit, skip])
        
        async with pool.acquire() as conn:
            # Get total count
            total = await conn.fetchval(count_query, *params[:-2])
            
            # Get paginated records
            records = await conn.fetch(query, *params)
            lab_requests = [dict(record) for record in records]
            
            # Calculate dashboard metrics
            metrics = await get_lab_request_metrics(pool, doctor_id)
            
            return {
                "success": True,
                "lab_requests": lab_requests,
                "total": total,
                "metrics": metrics,
                "filters_applied": {
                    "status": status,
                    "urgency": urgency,
                    "test_type": test_type,
                    "patient_id": str(patient_id) if patient_id else None,
                    "patient_name": patient_name,
                    "date_from": date_from.isoformat() if date_from else None,
                    "date_to": date_to.isoformat() if date_to else None,
                }
            }
            
    except Exception as e:
        raise DatabaseException(detail=f"Failed to get lab requests: {str(e)}")

# ==== GET LAB REQUEST DETAIL ====
@router.get("/{request_id}", response_model=schemas.LabRequestDetailResponse)
async def get_lab_request(
    request_id: uuid.UUID = Path(...),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Get a specific lab request with detailed information and history."""
    try:
        async with pool.acquire() as conn:
            # Get lab request with related data
            query = """
                SELECT lr.*, 
                       p.first_name || ' ' || p.last_name as patient_name,
                       p.date_of_birth,
                       p.gender,
                       p.phone_number,
                       p.blood_group,
                       u.full_name as doctor_name,
                       u.specialization as doctor_specialization
                FROM lab_requests lr
                JOIN patients p ON lr.patient_id = p.id
                JOIN users u ON lr.doctor_id = u.id
                WHERE lr.id = $1 AND lr.doctor_id = $2 AND lr.is_active = true
            """
            
            record = await conn.fetchrow(query, request_id, doctor_id)
            
            if not record:
                raise LabRequestNotFoundException()
                
            lab_request = dict(record)
            
            # Get history/audit trail
            history_query = """
                SELECT * FROM lab_request_history
                WHERE lab_request_id = $1
                ORDER BY created_at DESC
            """
            
            history_records = await conn.fetch(history_query, request_id)
            history = [dict(record) for record in history_records]
            
            # Get attached files
            files_query = """
                SELECT id, filename, file_type, file_size, created_at
                FROM lab_request_files
                WHERE lab_request_id = $1
                ORDER BY created_at DESC
            """
            
            file_records = await conn.fetch(files_query, request_id)
            files = []
            
            for file_record in file_records:
                file_dict = dict(file_record)
                file_dict["download_url"] = get_file_url(file_dict["id"], "lab_request_file")
                files.append(file_dict)
                
            # Get lab comments
            comments_query = """
                SELECT lrc.*, u.full_name as user_name, u.role as user_role
                FROM lab_request_comments lrc
                JOIN users u ON lrc.user_id = u.id
                WHERE lrc.lab_request_id = $1
                ORDER BY lrc.created_at DESC
            """
            
            comment_records = await conn.fetch(comments_query, request_id)
            comments = [dict(record) for record in comment_records]
            
            # Add these details to the response
            lab_request["history"] = history
            lab_request["files"] = files
            lab_request["comments"] = comments
            
            # Calculate patient age
            if lab_request.get("date_of_birth"):
                today = date.today()
                dob = lab_request["date_of_birth"]
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                lab_request["patient_age"] = age
            
            return {
                "success": True,
                "lab_request": lab_request
            }
            
    except LabRequestNotFoundException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to get lab request: {str(e)}")

# ==== UPDATE LAB REQUEST ====
@router.patch("/{request_id}", response_model=schemas.LabRequestResponse)
async def update_lab_request(
    request_id: uuid.UUID = Path(...),
    update_data: schemas.LabRequestUpdate = Body(...),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Update a lab request (notes, urgency, etc.)."""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Check if request exists and belongs to this doctor
                check_query = """
                    SELECT id, patient_id, status, test_type, urgency
                    FROM lab_requests
                    WHERE id = $1 AND doctor_id = $2 AND is_active = true
                """
                
                record = await conn.fetchrow(check_query, request_id, doctor_id)
                
                if not record:
                    raise LabRequestNotFoundException()
                    
                if record["status"] == "completed":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Completed lab requests cannot be updated"
                    )
                
                # Prepare update data
                update_fields = []
                params = [request_id]  # First param is always request_id
                param_index = 2
                
                if update_data.notes is not None:
                    update_fields.append(f"notes = ${param_index}")
                    params.append(update_data.notes)
                    param_index += 1
                    
                if update_data.urgency is not None:
                    if update_data.urgency not in LAB_REQUEST_PRIORITIES:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Invalid urgency. Must be one of: {', '.join(LAB_REQUEST_PRIORITIES)}"
                        )
                    update_fields.append(f"urgency = ${param_index}")
                    params.append(update_data.urgency)
                    param_index += 1
                
                if not update_fields:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="No fields to update"
                    )
                
                # Build update query
                update_query = f"""
                    UPDATE lab_requests
                    SET {", ".join(update_fields)}, updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                """
                
                updated_record = await conn.fetchrow(update_query, *params)
                updated_lab_request = dict(updated_record)
                
                # Add record to history
                history_id = uuid.uuid4()
                history_query = """
                    INSERT INTO lab_request_history (
                        id, lab_request_id, action, action_by, action_by_role,
                        previous_status, new_status, details
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """
                
                await conn.execute(
                    history_query,
                    history_id,
                    request_id,
                    "updated",
                    doctor_id,
                    "doctor",
                    record["status"],
                    updated_lab_request["status"],
                    json.dumps({
                        "updated_fields": [k for k, v in update_data.dict(exclude_unset=True).items()],
                        "details": "Doctor updated lab request"
                    })
                )
                
                # Create notification for lab technicians if urgency increased
                if (update_data.urgency == "urgent" and record["urgency"] == "routine") or \
                   (update_data.urgency == "stat" and record["urgency"] in ["routine", "urgent"]):
                    
                    # Get patient name
                    patient_name_query = "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1"
                    patient_name = await conn.fetchval(patient_name_query, record["patient_id"])
                    
                    # Get doctor name
                    doctor_name_query = "SELECT full_name FROM users WHERE id = $1"
                    doctor_name = await conn.fetchval(doctor_name_query, doctor_id)
                    
                    notification_title = f"Lab Request Urgency Increased to {update_data.urgency.upper()}"
                    notification_content = (
                        f"Dr. {doctor_name} has increased the urgency to {update_data.urgency} "
                        f"for {record['test_type']} test for patient {patient_name}."
                    )
                    
                    await create_notification_for_role(
                        pool,
                        "lab_technician",
                        notification_title,
                        notification_content,
                        "lab_request_urgency_changed",
                        request_id
                    )
                
                return {
                    "success": True,
                    "message": "Lab request updated successfully",
                    "lab_request": updated_lab_request
                }
                
    except LabRequestNotFoundException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to update lab request: {str(e)}")

# ==== DELETE LAB REQUEST ====
@router.delete("/{request_id}/permanent", response_model=schemas.BaseResponse)
async def delete_lab_request(
    request_id: uuid.UUID = Path(...),
    deletion_reason: str = Query(None, description="Reason for deletion"),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Permanently delete a lab request by marking it as inactive."""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Check if request exists and belongs to this doctor
                check_query = """
                    SELECT id, patient_id, status, test_type
                    FROM lab_requests
                    WHERE id = $1 AND doctor_id = $2 AND is_active = true
                """
                
                record = await conn.fetchrow(check_query, request_id, doctor_id)
                
                if not record:
                    raise LabRequestNotFoundException()
                
                # Check if the request has any associated results
                results_check_query = """
                    SELECT COUNT(*) 
                    FROM lab_request_files
                    WHERE lab_request_id = $1
                """
                
                has_results = await conn.fetchval(results_check_query, request_id)
                
                if has_results > 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot delete lab request that has associated results. Use cancel instead."
                    )
                
                # Mark request as inactive
                update_query = """
                    UPDATE lab_requests
                    SET is_active = false, updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                """
                
                deleted_record = await conn.fetchrow(update_query, request_id)
                
                # Add record to history
                history_id = uuid.uuid4()
                history_query = """
                    INSERT INTO lab_request_history (
                        id, lab_request_id, action, action_by, action_by_role,
                        previous_status, new_status, details
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """
                
                deletion_note = deletion_reason or "No reason provided"
                
                await conn.execute(
                    history_query,
                    history_id,
                    request_id,
                    "deleted",
                    doctor_id,
                    "doctor",
                    record["status"],
                    "deleted",
                    json.dumps({
                        "deletion_reason": deletion_note,
                        "details": "Doctor permanently deleted lab request"
                    })
                )
                
                # Get patient name for notification
                patient_name_query = "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1"
                patient_name = await conn.fetchval(patient_name_query, record["patient_id"])
                
                # Get doctor name for notification
                doctor_name_query = "SELECT full_name FROM users WHERE id = $1"
                doctor_name = await conn.fetchval(doctor_name_query, doctor_id)
                
                # Notify lab technicians
                notification_title = "Lab Request Deleted"
                notification_content = (
                    f"Dr. {doctor_name} has permanently deleted the {record['test_type']} test "
                    f"for patient {patient_name}.\n\nReason: {deletion_note}"
                )
                
                await create_notification_for_role(
                    pool,
                    "lab_technician",
                    notification_title,
                    notification_content,
                    "lab_request_deleted",
                    request_id
                )
                
                return {
                    "success": True,
                    "message": "Lab request deleted successfully"
                }
                
    except LabRequestNotFoundException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to delete lab request: {str(e)}")

# ==== CANCEL LAB REQUEST ====
@router.delete("/{request_id}", response_model=schemas.BaseResponse)
async def cancel_lab_request(
    request_id: uuid.UUID = Path(...),
    cancellation_reason: str = Query(None, description="Reason for cancellation"),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Cancel a lab request that hasn't been processed yet."""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Check if request exists and belongs to this doctor
                check_query = """
                    SELECT id, patient_id, status, test_type
                    FROM lab_requests
                    WHERE id = $1 AND doctor_id = $2 AND is_active = true
                """
                
                record = await conn.fetchrow(check_query, request_id, doctor_id)
                
                if not record:
                    raise LabRequestNotFoundException()
                    
                if record["status"] not in ["pending", "in_progress"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Only pending or in-progress lab requests can be cancelled"
                    )
                
                # Update request status
                update_query = """
                    UPDATE lab_requests
                    SET status = 'cancelled', updated_at = NOW(), notes = CASE 
                        WHEN notes IS NULL OR notes = '' THEN $2
                        ELSE notes || E'\n\nCancellation reason: ' || $2
                    END
                    WHERE id = $1
                    RETURNING *
                """
                
                cancel_note = cancellation_reason or "No reason provided"
                cancelled_record = await conn.fetchrow(update_query, request_id, cancel_note)
                
                # Add record to history
                history_id = uuid.uuid4()
                history_query = """
                    INSERT INTO lab_request_history (
                        id, lab_request_id, action, action_by, action_by_role,
                        previous_status, new_status, details
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """
                
                await conn.execute(
                    history_query,
                    history_id,
                    request_id,
                    "cancelled",
                    doctor_id,
                    "doctor",
                    record["status"],
                    "cancelled",
                    json.dumps({
                        "cancellation_reason": cancel_note,
                        "details": "Doctor cancelled lab request"
                    })
                )
                
                # Get patient name for notification
                patient_name_query = "SELECT first_name || ' ' || last_name FROM patients WHERE id = $1"
                patient_name = await conn.fetchval(patient_name_query, record["patient_id"])
                
                # Get doctor name for notification
                doctor_name_query = "SELECT full_name FROM users WHERE id = $1"
                doctor_name = await conn.fetchval(doctor_name_query, doctor_id)
                
                # Notify lab technicians
                notification_title = "Lab Request Cancelled"
                notification_content = (
                    f"Dr. {doctor_name} has cancelled the {record['test_type']} test "
                    f"for patient {patient_name}.\n\nReason: {cancel_note}"
                )
                
                await create_notification_for_role(
                    pool,
                    "lab_technician",
                    notification_title,
                    notification_content,
                    "lab_request_cancelled",
                    request_id
                )
                
                return {
                    "success": True,
                    "message": "Lab request cancelled successfully"
                }
                
    except LabRequestNotFoundException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to cancel lab request: {str(e)}")

# ==== ADD COMMENT TO LAB REQUEST ====
@router.post("/{request_id}/comments", response_model=schemas.LabRequestCommentResponse)
async def add_comment_to_lab_request(
    request_id: uuid.UUID = Path(...),
    comment_data: schemas.LabRequestCommentCreate = Body(...),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Add a comment to a lab request."""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Check if request exists and belongs to this doctor
                check_query = """
                    SELECT id, patient_id, status, test_type
                    FROM lab_requests
                    WHERE id = $1 AND doctor_id = $2 AND is_active = true
                """
                
                record = await conn.fetchrow(check_query, request_id, doctor_id)
                
                if not record:
                    raise LabRequestNotFoundException()
                
                # Create comment
                comment_id = uuid.uuid4()
                comment_query = """
                    INSERT INTO lab_request_comments (
                        id, lab_request_id, user_id, comment, is_private
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id, comment, is_private, created_at
                """
                
                comment_record = await conn.fetchrow(
                    comment_query, 
                    comment_id,
                    request_id,
                    doctor_id,
                    comment_data.comment,
                    comment_data.is_private
                )
                
                comment = dict(comment_record)
                
                # Get doctor name
                doctor_name_query = "SELECT full_name FROM users WHERE id = $1"
                doctor_name = await conn.fetchval(doctor_name_query, doctor_id)
                comment["user_name"] = doctor_name
                comment["user_role"] = "doctor"
                
                # If not private, notify lab technicians
                if not comment_data.is_private:
                    notification_title = "New Comment on Lab Request"
                    notification_content = (
                        f"Dr. {doctor_name} added a comment to lab request: {comment_data.comment[:100]}"
                        f"{'...' if len(comment_data.comment) > 100 else ''}"
                    )
                    
                    await create_notification_for_role(
                        pool,
                        "lab_technician",
                        notification_title,
                        notification_content,
                        "lab_request_comment_added",
                        request_id
                    )
                
                return {
                    "success": True,
                    "message": "Comment added successfully",
                    "comment": comment
                }
                
    except LabRequestNotFoundException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to add comment: {str(e)}")

# ==== UPLOAD FILE TO LAB REQUEST ====
@router.post("/{request_id}/files", response_model=schemas.LabRequestFileResponse)
async def upload_file_to_lab_request(
    request_id: uuid.UUID = Path(...),
    file: UploadFile = File(...),
    file_description: str = Query(None, description="Description of the file"),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Upload a file attachment to a lab request."""
    try:
        # Validate file type
        if file.content_type not in ALLOWED_LAB_RESULT_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_LAB_RESULT_MIME_TYPES)}"
            )
        
        async with pool.acquire() as conn:
            # Check if request exists and belongs to this doctor
            check_query = """
                SELECT id
                FROM lab_requests
                WHERE id = $1 AND doctor_id = $2 AND is_active = true
            """
            
            record = await conn.fetchval(check_query, request_id, doctor_id)
            
            if not record:
                raise LabRequestNotFoundException()
            
            # Read file content
            file_content = await file.read()
            file_size = len(file_content)
            
            # Save file to storage and get file ID
            file_id = await save_file_to_storage(
                file_content, 
                file.filename, 
                file.content_type, 
                "lab_request_file"
            )
            
            # Save file metadata in database
            file_query = """
                INSERT INTO lab_request_files (
                    id, lab_request_id, filename, file_type, file_size, 
                    description, uploaded_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, filename, file_type, file_size, description, created_at
            """
            
            file_record = await conn.fetchrow(
                file_query,
                file_id,
                request_id,
                file.filename,
                file.content_type,
                file_size,
                file_description,
                doctor_id
            )
            
            file_data = dict(file_record)
            file_data["download_url"] = get_file_url(file_id, "lab_request_file")
            
            # Add history record
            history_id = uuid.uuid4()
            history_query = """
                INSERT INTO lab_request_history (
                    id, lab_request_id, action, action_by, action_by_role,
                    previous_status, new_status, details
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """
            
            lab_request_query = "SELECT status FROM lab_requests WHERE id = $1"
            status_value = await conn.fetchval(lab_request_query, request_id)
            
            await conn.execute(
                history_query,
                history_id,
                request_id,
                "file_uploaded",
                doctor_id,
                "doctor",
                status_value,
                status_value,
                json.dumps({
                    "file_id": str(file_id),
                    "filename": file.filename,
                    "file_type": file.content_type,
                    "file_size": file_size,
                    "description": file_description
                })
            )
            
            # Notify lab technicians
            notification_title = "New File Added to Lab Request"
            notification_content = (
                f"A file ({file.filename}) has been added to lab request {request_id} by a doctor."
            )
            
            await create_notification_for_role(
                pool,
                "lab_technician",
                notification_title,
                notification_content,
                "lab_request_file_added",
                request_id
            )
            
            return {
                "success": True,
                "message": "File uploaded successfully",
                "file": file_data
            }
            
    except LabRequestNotFoundException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to upload file: {str(e)}")

# ==== ANALYTICS AND REPORTING ====
@router.get("/analytics/summary", response_model=schemas.LabRequestAnalyticsSummary)
async def get_lab_request_analytics(
    date_from: Optional[date] = Query(None, description="Start date for analytics"),
    date_to: Optional[date] = Query(None, description="End date for analytics"),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Get analytics and summary statistics for lab requests."""
    try:
        # Set default date range if not provided (last 30 days)
        if not date_to:
            date_to = date.today()
        if not date_from:
            date_from = date_to - timedelta(days=30)
            
        async with pool.acquire() as conn:
            # Get status counts
            status_query = """
                SELECT status, COUNT(*) as count
                FROM lab_requests
                WHERE doctor_id = $1 
                AND is_active = true
                AND DATE(created_at) BETWEEN $2 AND $3
                GROUP BY status
            """
            
            status_records = await conn.fetch(status_query, doctor_id, date_from, date_to)
            status_counts = {record["status"]: record["count"] for record in status_records}
            
            # Get counts by test type
            test_type_query = """
                SELECT test_type, COUNT(*) as count
                FROM lab_requests
                WHERE doctor_id = $1 
                AND is_active = true
                AND DATE(created_at) BETWEEN $2 AND $3
                GROUP BY test_type
                ORDER BY count DESC
                LIMIT 10
            """
            
            test_type_records = await conn.fetch(test_type_query, doctor_id, date_from, date_to)
            test_type_counts = [dict(record) for record in test_type_records]
            
            # Get counts by urgency
            urgency_query = """
                SELECT urgency, COUNT(*) as count
                FROM lab_requests
                WHERE doctor_id = $1 
                AND is_active = true
                AND DATE(created_at) BETWEEN $2 AND $3
                GROUP BY urgency
            """
            
            urgency_records = await conn.fetch(urgency_query, doctor_id, date_from, date_to)
            urgency_counts = {record["urgency"]: record["count"] for record in urgency_records}
            
            # Get trend data (requests per day/week)
            trend_query = """
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM lab_requests
                WHERE doctor_id = $1 
                AND is_active = true
                AND DATE(created_at) BETWEEN $2 AND $3
                GROUP BY DATE(created_at)
                ORDER BY date
            """
            
            trend_records = await conn.fetch(trend_query, doctor_id, date_from, date_to)
            trend_data = [dict(record) for record in trend_records]
            
            # Get average turnaround time (from request to result)
            turnaround_query = """
                SELECT 
                    EXTRACT(EPOCH FROM AVG(
                        CASE 
                            WHEN status = 'completed' THEN updated_at - created_at
                            ELSE NULL
                        END
                    ))/3600 as avg_hours
                FROM lab_requests
                WHERE doctor_id = $1 
                AND is_active = true
                AND status = 'completed'
                AND DATE(created_at) BETWEEN $2 AND $3
            """
            
            avg_turnaround_hours = await conn.fetchval(turnaround_query, doctor_id, date_from, date_to)
            
            return {
                "success": True,
                "date_range": {
                    "from": date_from.isoformat(),
                    "to": date_to.isoformat()
                },
                "status_counts": status_counts,
                "test_type_counts": test_type_counts,
                "urgency_counts": urgency_counts,
                "trend_data": trend_data,
                "average_turnaround_hours": avg_turnaround_hours or 0
            }
            
    except Exception as e:
        raise DatabaseException(detail=f"Failed to get analytics: {str(e)}")

# ==== HELPER FUNCTIONS ====

async def get_doctor_name(pool, doctor_id: uuid.UUID) -> str:
    """Get the name of a doctor by ID."""
    async with pool.acquire() as conn:
        query = "SELECT full_name FROM users WHERE id = $1 AND role = 'doctor'"
        name = await conn.fetchval(query, doctor_id)
        return name or "Unknown Doctor"

async def get_lab_technicians(pool) -> List[Dict[str, Any]]:
    """Get all lab technicians."""
    async with pool.acquire() as conn:
        query = """
            SELECT id, full_name, email
            FROM users
            WHERE role = 'lab_technician' AND is_active = true
        """
        records = await conn.fetch(query)
        return [dict(record) for record in records]

async def get_lab_request_metrics(pool, doctor_id: uuid.UUID) -> Dict[str, Any]:
    """Get lab request metrics for dashboard."""
    async with pool.acquire() as conn:
        # Get counts by status
        status_query = """
            SELECT status, COUNT(*) as count
            FROM lab_requests
            WHERE doctor_id = $1 AND is_active = true
            GROUP BY status
        """
        
        status_records = await conn.fetch(status_query, doctor_id)
        status_counts = {record["status"]: record["count"] for record in status_records}
        
        # Get pending urgent/stat requests count
        urgent_query = """
            SELECT COUNT(*) FROM lab_requests
            WHERE doctor_id = $1 AND is_active = true 
            AND status = 'pending' AND (urgency = 'urgent' OR urgency = 'stat')
        """
        
        urgent_count = await conn.fetchval(urgent_query, doctor_id)
        
        # Get today's new requests count
        today_query = """
            SELECT COUNT(*) FROM lab_requests
            WHERE doctor_id = $1 AND is_active = true 
            AND DATE(created_at) = CURRENT_DATE
        """
        
        today_count = await conn.fetchval(today_query, doctor_id)
        
        return {
            "pending": status_counts.get("pending", 0),
            "in_progress": status_counts.get("in_progress", 0),
            "completed": status_counts.get("completed", 0),
            "cancelled": status_counts.get("cancelled", 0),
            "urgent_pending": urgent_count or 0,
            "today_new": today_count or 0
        }
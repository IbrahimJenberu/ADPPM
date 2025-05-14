# app/routes/history.py
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from datetime import datetime, date, timedelta
import json

from ..schemas import LabRequestHistoryResponse, LabRequestEvent
from ..database import get_connection, fetch_all
from ..exceptions import NotFoundException, DatabaseException

router = APIRouter(prefix="/history", tags=["History"])

@router.get("/lab-requests/{request_id}", response_model=LabRequestHistoryResponse)
async def get_lab_request_history(
    request_id: uuid.UUID = Path(...),
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    Get the complete history/audit trail for a specific lab request.
    """
    conn = await get_connection()
    
    try:
        # Check if lab request exists
        check_query = "SELECT id FROM lab_requests WHERE id = $1 AND is_deleted = FALSE"
        request_exists = await conn.fetchval(check_query, str(request_id))
        
        if not request_exists:
            raise NotFoundException("Lab request", str(request_id))
        
        # Get all events for this lab request
        query = """
            SELECT lre.*, u.full_name as user_name
            FROM lab_request_events lre
            LEFT JOIN users u ON lre.user_id = u.id
            WHERE lre.lab_request_id = $1
            ORDER BY lre.event_timestamp DESC
        """
        
        rows = await conn.fetch(query, str(request_id))
        
        events = []
        for row in rows:
            event_dict = dict(row)
            # Parse details JSON if it exists
            if "details" in event_dict and event_dict["details"]:
                if isinstance(event_dict["details"], str):
                    try:
                        event_dict["details"] = json.loads(event_dict["details"])
                    except:
                        # Keep as string if invalid JSON
                        pass
            
            # Add user name to details if available
            if "user_name" in event_dict and event_dict["user_name"]:
                if "details" not in event_dict or not event_dict["details"]:
                    event_dict["details"] = {}
                
                if isinstance(event_dict["details"], dict):
                    event_dict["details"]["user_name"] = event_dict["user_name"]
            
            events.append(event_dict)
        
        return {
            "success": True,
            "events": events
        }
    
    except NotFoundException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to fetch history data: {str(e)}")
    finally:
        await conn.close()

@router.get("/lab-technician/{tech_id}", response_model=Dict[str, Any])
async def get_lab_technician_history(
    tech_id: uuid.UUID = Path(...),
    from_date: Optional[date] = Query(None, description="Start date for history"),
    to_date: Optional[date] = Query(None, description="End date for history"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Get the activity history for a specific lab technician.
    """
    # Set default date range if not provided (last 30 days)
    if not to_date:
        to_date = date.today()
    if not from_date:
        from_date = to_date - timedelta(days=30)
    
    conn = await get_connection()
    
    try:
        # Build query - modified to not rely on patients table
        query_parts = ["""
            SELECT lre.*, lr.test_type, lr.status
            FROM lab_request_events lre
            JOIN lab_requests lr ON lre.lab_request_id = lr.id
            WHERE lre.user_id = $1
            AND DATE(lre.event_timestamp) BETWEEN $2 AND $3
        """]
        
        params = [str(tech_id), from_date, to_date]
        param_index = 4
        
        # Add event type filter if provided
        if event_type:
            query_parts.append(f"AND lre.event_type = ${param_index}")
            params.append(event_type)
            param_index += 1
        
        # Add ordering
        query_parts.append("ORDER BY lre.event_timestamp DESC")
        
        # Count total matching records
        count_query = f"SELECT COUNT(*) FROM ({' '.join(query_parts)}) as filtered_events"
        total = await conn.fetchval(count_query, *params)
        
        # Add pagination
        offset = (page - 1) * page_size
        query_parts.append(f"LIMIT ${param_index} OFFSET ${param_index + 1}")
        params.extend([page_size, offset])
        
        # Execute main query
        rows = await conn.fetch(' '.join(query_parts), *params)
        
        events = []
        for row in rows:
            event_dict = dict(row)
            # Parse details JSON if it exists
            if "details" in event_dict and event_dict["details"]:
                if isinstance(event_dict["details"], str):
                    try:
                        event_dict["details"] = json.loads(event_dict["details"])
                    except:
                        # Keep as string if invalid JSON
                        pass
            
            events.append(event_dict)
        
        # Calculate total pages
        total_pages = (total + page_size - 1) // page_size
        
        return {
            "success": True,
            "events": events,
            "pagination": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            }
        }
    
    except Exception as e:
        raise DatabaseException(detail=f"Failed to fetch history data: {str(e)}")
    finally:
        await conn.close()
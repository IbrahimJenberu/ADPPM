"""
Router for advanced search functionality.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from uuid import UUID
from typing import Optional, List, Dict, Any
from asyncpg import Connection
import uuid

from app.schemas import (
    PatientResponse, PatientsResponse
)
from app.models import PatientModel
from app.dependencies import get_db_connection
from app.security import card_room_worker_only

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/patients", response_model=PatientsResponse)
async def advanced_patient_search(
    query: Optional[str] = Query(None, description="Search term"),
    registration_number: Optional[str] = Query(None, description="Registration number"),
    phone: Optional[str] = Query(None, description="Phone number"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    conn: Connection = Depends(get_db_connection)
):
    """Advanced search for patients with multiple criteria."""
    offset = (page - 1) * page_size
    
    conditions = ["is_deleted = FALSE"]
    params = []
    param_index = 1

    if query:
        conditions.append(f"(first_name ILIKE ${param_index} OR last_name ILIKE ${param_index})")
        params.append(f"%{query}%")
        param_index += 1
    
    if registration_number:
        conditions.append(f"registration_number ILIKE ${param_index}")
        params.append(f"%{registration_number}%")
        param_index += 1
    
    if phone:
        conditions.append(f"phone_number ILIKE ${param_index}")
        params.append(f"%{phone}%")
        param_index += 1
    
    where_clause = " AND ".join(conditions) or "TRUE"
    
    try:
        # Count total
        count_query = f"SELECT COUNT(*) FROM patients WHERE {where_clause}"
        total = await conn.fetchval(count_query, *params)
        
        # Get results
        results_query = f"""
            SELECT * FROM patients 
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT ${param_index} OFFSET ${param_index + 1}
        """
        params.extend([page_size, offset])
        results = await conn.fetch(results_query, *params)
        
        return PatientsResponse(
            data=[dict(r) for r in results],
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
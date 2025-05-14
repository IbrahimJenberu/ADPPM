from fastapi import Depends, HTTPException, status, Query
from typing import Dict, Any, Optional
import uuid
from .database import get_connection, fetch_one
from .security import get_current_user, require_lab_technician
from .models import LabRequest, LabResult
from .exceptions import NotFoundException

async def get_lab_request(
    request_id: uuid.UUID,
    lab_technician_id: Optional[uuid.UUID] = None,
    current_user: Optional[Dict[str, Any]] = None
) -> LabRequest:
    """
    Get a lab request by ID.
    
    This function is a dependency that retrieves a lab request and checks if the user
    has permission to access it.
    """
    conn = await get_connection()
    
    try:
        query = "SELECT * FROM lab_requests WHERE id = $1 AND is_deleted = FALSE"
        row = await fetch_one(query, str(request_id), conn=conn)
        
        if not row:
            raise NotFoundException("Lab request", str(request_id))
        
        # Convert row to LabRequest object
        lab_request = LabRequest.from_db_row(row)
        
        # Check permissions if current_user is provided
        if current_user and not lab_technician_id:
            user_id = current_user.get("sub")
            role = current_user.get("role")
            
            # If not admin and not the requesting doctor or assigned technician, deny access
            if (
                role != "admin" and
                str(lab_request.doctor_id) != user_id and
                (lab_request.technician_id is None or str(lab_request.technician_id) != user_id)
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this lab request"
                )
        
        return lab_request
    finally:
        await conn.close()

async def get_lab_result(
    result_id: uuid.UUID,
    lab_technician_id: Optional[uuid.UUID] = None
) -> LabResult:
    """
    Get a lab result by ID.
    
    This function is a dependency that retrieves a lab result and checks if the user
    has permission to access it.
    """
    conn = await get_connection()
    
    try:
        query = "SELECT * FROM lab_results WHERE id = $1 AND is_deleted = FALSE"
        row = await fetch_one(query, str(result_id), conn=conn)
        
        if not row:
            raise NotFoundException("Lab result", str(result_id))
        
        # Convert row to LabResult object
        lab_result = LabResult.from_db_row(row)
        
        return lab_result
    finally:
        await conn.close()

async def get_paginated_params(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100)
) -> Dict[str, int]:
    """
    Get pagination parameters from query params.
    """
    return {"page": page, "size": size}
        
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import Optional

from app.config import settings
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_labtechnician(token: str = Depends(oauth2_scheme)):
    """Get current labtechnician from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        labtechnician_id: str = payload.get("sub")
        role: str = payload.get("role")
        
        if not labtechnician_id or role != "labroom":
            raise credentials_exception
            
        return {"id": labtechnician_id, "role": role}
        
    except JWTError:
        raise credentials_exception

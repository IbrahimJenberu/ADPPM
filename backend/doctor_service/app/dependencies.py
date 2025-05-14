# doctor_service/app/dependencies.py
import asyncpg
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict, List, Any
from datetime import datetime
from app.config import settings
from app.exceptions import UnauthorizedException

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_db_pool():
    """Create and return a database connection pool."""
    pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=5,
        max_size=20
    )
    try:
        yield pool
    finally:
        await pool.close()
        
async def init_connection(conn):
    # Configure date handling
    await conn.set_type_codec(
        'date',
        encoder=lambda d: d.isoformat(),
        decoder=lambda s: datetime.strptime(s, '%Y-%m-%d').date(),
        format='text'
    )

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Decode JWT token to get current user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        user_role: str = payload.get("role")
        
        if user_id is None:
            raise credentials_exception
        
        return {"id": user_id, "role": user_role}
    
    except jwt.PyJWTError:
        raise credentials_exception

async def get_current_doctor():
    """Bypass authentication and return a dummy doctor."""
    return {"id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "role": "doctor", "full_name": "Dr. Test"}


async def validate_doctor_patient_access(
    patient_id: str,
    pool = Depends(get_db_pool),
    current_doctor = Depends(get_current_doctor)
):
    """Verify doctor has access to the patient."""
    async with pool.acquire() as conn:
        query = """
            SELECT EXISTS (
                SELECT 1 FROM patient_doctor_assignments
                WHERE doctor_id = $1 AND patient_id = $2 AND is_active = true
            ) as has_access
        """
        result = await conn.fetchval(query, current_doctor["id"], patient_id)
        
        if not result:
            raise UnauthorizedException(
                detail="Doctor does not have access to this patient"
            )
    
    return current_doctor


from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import Optional

from app.config import settings
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_doctor(token: str = Depends(oauth2_scheme)):
    """Get current doctor from JWT token"""
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
        doctor_id: str = payload.get("sub")
        role: str = payload.get("role")
        
        if not doctor_id or role != "doctor":
            raise credentials_exception
            
        return {"id": doctor_id, "role": role}
        
    except JWTError:
        raise credentials_exception
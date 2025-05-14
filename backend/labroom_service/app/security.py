import jwt
from fastapi import Depends, Security, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List
import uuid
from .config import settings

# Security scheme for JWT authentication
security = HTTPBearer()

def decode_jwt(token: str) -> Dict[str, Any]:
    """Decode JWT token"""
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET_KEY, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Get current user from JWT token"""
    token = credentials.credentials
    user_data = decode_jwt(token)
    return user_data

def validate_role(allowed_roles: List[str], user_data: Dict[str, Any] = Depends(get_current_user)):
    """Validate user role"""
    role = user_data.get("role")
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' is not authorized to access this resource",
        )
    return user_data

def require_lab_technician(user_data: Dict[str, Any] = Depends(get_current_user)):
    """Require lab technician role"""
    return validate_role(["lab_technician", "admin"], user_data)
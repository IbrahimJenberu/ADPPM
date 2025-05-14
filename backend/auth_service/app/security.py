"""Security utilities for authentication and authorization."""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Union
import uuid
from jose import jwt, JWTError
from passlib.context import CryptContext
import logging

from .security_config import security_settings

# Set up logging
logger = logging.getLogger("auth_service.security")

# Create password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = {
        k: (str(v) if isinstance(v, uuid.UUID) else v)
        for k, v in data.items()
    }

    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=security_settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    
    try:
        encoded_jwt = jwt.encode(
            to_encode, 
            security_settings.secret_key, 
            algorithm=security_settings.algorithm
        )
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating access token: {e}")
        raise


def create_refresh_token(user_id: str) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        user_id: User ID to include in the token
        
    Returns:
        JWT refresh token string
    """
    expires = datetime.utcnow() + timedelta(days=security_settings.refresh_token_expire_days)
    
    to_encode = {
        "sub": str(user_id),
        "exp": expires,
        "jti": str(uuid.uuid4()),
        "type": "refresh"
    }
    
    try:
        encoded_jwt = jwt.encode(
            to_encode, 
            security_settings.secret_key, 
            algorithm=security_settings.algorithm
        )
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating refresh token: {e}")
        raise

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password to compare against
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hash a password.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password
    """
    return pwd_context.hash(password)

def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded payload
        
    Raises:
        JWTError: If token is invalid
    """
    try:
        payload = jwt.decode(
            token, 
            security_settings.secret_key,
            algorithms=[security_settings.algorithm]
        )
        return payload
    except JWTError as e:
        logger.error(f"Error decoding token: {e}")
        raise

"""
Security utilities and JWT validation functions.
"""
import httpx
from fastapi import Depends, HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any, List
from app.config import settings
import logging

security = HTTPBearer()

# Role definitions
CARD_ROOM_WORKER = "card_room_worker"
DOCTOR = "doctor"
LAB_TECHNICIAN = "lab_technician"
ADMIN = "admin"

class TokenValidator:
    """Validates JWT tokens and handles authorization."""
    
    @staticmethod
    async def validate_token(
        credentials: HTTPAuthorizationCredentials = Security(security),
        request: Request = None,
    ) -> Dict[str, Any]:
        """
        Validates the JWT token by calling the auth service.
        Returns the decoded token payload if valid.
        """
        token = credentials.credentials
        
        try:
            # Call auth service to validate the token
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.AUTH_SERVICE_URL}/api/auth/validate-token",
                    json={"token": token},
                    timeout=5.0
                )
                
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid authentication credentials"
                    )
                
                data = response.json()
                
                # Store user_id and client IP in context for audit logs
                if request and hasattr(request.state, "connection"):
                    client_ip = request.client.host if request.client else "unknown"
                    conn = request.state.connection
                    await conn.execute("SET app.current_user_id TO $1", data["user_id"])
                    await conn.execute("SET app.client_ip TO $1", client_ip)
                
                return data
                
        except httpx.RequestError as e:
            logging.error(f"Error validating token: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Authentication service unavailable"
            )
    
    @staticmethod
    async def validate_role(
        required_roles: List[str],
        token_data: Dict[str, Any] = Depends(validate_token)
    ) -> Dict[str, Any]:
        """
        Validates that the user has one of the required roles.
        Returns the token data if valid.
        """
        user_role = token_data.get("role")
        
        if not user_role or user_role not in required_roles:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )
        
        return token_data
 
async def any_authenticated_user(
    token_data: Dict[str, Any] = Depends(TokenValidator.validate_token)
) -> Dict[str, Any]:
    """Dependency for endpoints that require any authenticated user."""
    return token_data


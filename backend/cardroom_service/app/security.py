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

# Dependency functions for specific roles
async def card_room_worker_only(
    token_data: Dict[str, Any] = Depends(
        lambda: TokenValidator.validate_role([CARD_ROOM_WORKER, ADMIN])
    )
) -> Dict[str, Any]:
    """Dependency for endpoints that require Card Room Worker role."""
    return token_data

async def any_authenticated_user(
    token_data: Dict[str, Any] = Depends(TokenValidator.validate_token)
) -> Dict[str, Any]:
    """Dependency for endpoints that require any authenticated user."""
    return token_data
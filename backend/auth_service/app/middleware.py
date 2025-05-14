# auth_service/app/middleware.py
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from app.config import settings

class ServiceAuthMiddleware(BaseHTTPMiddleware):
    """Middleware to validate service tokens for inter-service communication."""

    async def dispatch(self, request: Request, call_next):
        # Skip validation for public endpoints
        if self._is_public_path(request.url.path):
            return await call_next(request)

        # Skip validation for auth endpoints
        if request.url.path.startswith("/api/auth") or request.url.path.startswith("/api/service-auth"):
            return await call_next(request)

        # Check for service token
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            service_data = self._validate_service_token(token)

            if service_data:
                request.state.service_data = service_data
                return await call_next(request)

        # If no valid service token, reject the request
        raise HTTPException(status_code=401, detail="Invalid or missing service token")

    
    def _is_public_path(self, path: str) -> bool:
        public_paths = [
            "/docs", 
            "/redoc", 
            "/openapi.json",
            "/health",
            "/api/users/",  # <-- Allow user info endpoints without token
            "/api/users/by-role/doctor"
            f"/api/users/",  # <-- add this
        ]
        for public_path in public_paths:
            if path.startswith(public_path):
                return True
        return False

    
    def _validate_service_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate a service token and return the service data if valid."""
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            
            # Check if it's a service token
            if payload.get("role") != "service":
                return None
            
            # Check if token is expired
            exp = payload.get("exp")
            if exp and datetime.utcnow().timestamp() > exp:
                return None
            
            return payload
            
        except jwt.PyJWTError as e:
            logging.error(f"Token validation error: {e}")
            return None
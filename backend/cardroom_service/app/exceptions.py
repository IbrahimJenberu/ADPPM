"""
Custom exceptions and exception handlers.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from typing import Dict, Any, List, Optional
import logging

class AppException(Exception):
    """Base application exception class."""
    def __init__(
        self,
        status_code: int,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        self.status_code = status_code
        self.message = message
        self.details = details or {}
        super().__init__(message)

class ResourceNotFoundException(AppException):
    """Exception for when a requested resource is not found."""
    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            message=f"{resource_type} with ID {resource_id} not found",
            details={"resource_type": resource_type, "resource_id": resource_id}
        )

class ConflictException(AppException):
    """Exception for when there's a conflict (e.g., unique constraint violation)."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            message=message,
            details=details
        )

class BadRequestException(AppException):
    """Exception for invalid requests."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            message=message,
            details=details
        )

class ForbiddenException(AppException):
    """Exception for forbidden actions."""
    def __init__(self, message: str = "You don't have permission to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            message=message
        )

# Exception handlers
# app/exceptions.py
from datetime import datetime

def app_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, ResourceNotFoundException):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "message": exc.message,
                "details": exc.details
            }
        )
    elif isinstance(exc, ConflictException):
        # Convert datetime objects to ISO strings
        sanitized_details = {}
        for k, v in exc.details.items():
            if isinstance(v, datetime):
                sanitized_details[k] = v.isoformat()
            else:
                sanitized_details[k] = v
                
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "message": exc.message,
                "details": sanitized_details
            }
        )
    # ... other exception handlers

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handler for request validation exceptions."""
    errors = []
    for error in exc.errors():
        location = " -> ".join([str(loc) for loc in error["loc"] if loc != "body"])
        errors.append({
            "location": location,
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error",
            "details": {"errors": errors}
        }
    )

async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handler for unhandled exceptions."""
    # Log the exception
    logging.exception(f"Unhandled exception: {str(exc)}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An unexpected error occurred",
            "details": {"error": str(exc) if str(exc) else "Unknown error"}
        }
    )

def register_exception_handlers(app):
    """Register all exception handlers with the FastAPI app."""
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
    
class ServiceUnavailableException(AppException):
    """Exception for when an external service is unavailable."""
    def __init__(self, message: str = "Service unavailable", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            message=message,
            details=details
        )
        
class BadRequestException(Exception):
    def __init__(self, message: str, details: Optional[Dict] = None):
        self.message = message
        self.details = self._ensure_serializable(details)
        
    def _ensure_serializable(self, data):
        if not data:
            return data
            
        result = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result
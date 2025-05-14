from fastapi import HTTPException, status

class LabServiceException(HTTPException):
    """Base exception for the lab service."""
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class NotFoundException(LabServiceException):
    """Resource not found exception."""
    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_type} with ID {resource_id} not found"
        )

class UnauthorizedException(LabServiceException):
    """Unauthorized access exception."""
    def __init__(self, message: str = "Unauthorized access"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message
        )

class ForbiddenException(LabServiceException):
    """Forbidden access exception."""
    def __init__(self, message: str = "Access forbidden"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )

class BadRequestException(LabServiceException):
    """Bad request exception."""
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

class DatabaseException(LabServiceException):
    """Database operation exception."""
    def __init__(self, message: str = "Database operation failed"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message
        )

class ExternalServiceException(LabServiceException):
    """External service communication exception."""
    def __init__(self, service_name: str, message: str):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error communicating with {service_name}: {message}"
        )

class LabRequestAlreadyProcessedException(LabServiceException):
    """Lab request already processed exception."""
    def __init__(self, request_id: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lab request {request_id} is already processed"
        )

class FileUploadException(LabServiceException):
    """File upload exception."""
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File upload error: {message}"
        )
        
# First, define the DatabaseException class properly
class DatabaseException(Exception):
    """Base class for database exceptions"""
    def __init__(self, message=None, detail=None):
        self.message = message or "Database error occurred"
        self.detail = detail
        super().__init__(self.detail if detail else self.message)
        
class LabRequestNotFoundException(NotFoundException):
    """Raised when a lab request with the given ID does not exist."""
    def __init__(self, request_id: str):
        super().__init__(resource_type="LabRequest", resource_id=request_id)
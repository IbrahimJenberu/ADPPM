"""Custom exceptions for the application."""
from fastapi import HTTPException, status

class InvalidCredentialsException(HTTPException):
    """Exception for invalid credentials."""
    
    def __init__(self):
        """Initialize with 401 Unauthorized status."""
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )

class PermissionDeniedException(HTTPException):
    """Exception for permission denied."""
    
    def __init__(self):
        """Initialize with 403 Forbidden status."""
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

class UserNotFoundException(HTTPException):
    """Exception for user not found."""
    
    def __init__(self):
        """Initialize with 404 Not Found status."""
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

class ResourceNotFoundException(HTTPException):
    """Exception for resource not found."""
    
    def __init__(self, resource_name: str):
        """
        Initialize with 404 Not Found status.
        
        Args:
            resource_name: Name of the resource not found
        """
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_name} not found"
        )

class ResourceExistsException(HTTPException):
    """Exception for resource already exists."""
    
    def __init__(self, resource_name: str):
        """
        Initialize with 409 Conflict status.
        
        Args:
            resource_name: Name of the resource that already exists
        """
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{resource_name} already exists"
        )

class InvalidTokenException(HTTPException):
    """Exception for invalid token."""
    
    def __init__(self):
        """Initialize with 400 Bad Request status."""
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )

class DatabaseException(HTTPException):
    """Exception for database errors."""
    
    def __init__(self, detail: str = "Database error occurred"):
        """
        Initialize with 500 Internal Server Error status.
        
        Args:
            detail: Error detail
        """
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail
        )
        
class RateLimitExceededException(HTTPException):
    """Exception for rate limit exceeded."""
    
    def __init__(self, detail: str = "Rate limit exceeded"):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail
        )

class MFARequiredException(HTTPException):
    """Exception for MFA required."""
    
    def __init__(self, token: str):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA verification required",
            headers={"X-MFA-Required": "true", "X-MFA-Token": token}
        )
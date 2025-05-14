from datetime import datetime
import traceback
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List

class DoctorServiceException(HTTPException):
    """Base exception for the Doctor Service with enhanced diagnostics"""
    def __init__(
        self,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail: str = "Service error occurred",
        error_code: str = "DOCTOR-000",
        context: Optional[Dict[str, Any]] = None,
        include_debug: bool = False
    ):
        # Preserve original exception information
        self.error_code = error_code
        self.timestamp = datetime.utcnow().isoformat()
        self.context = context or {}
        self.original_exception = traceback.format_exc() if include_debug else None
        
        # Structure error response
        error_data = {
            "error_code": error_code,
            "message": detail,
            "timestamp": self.timestamp
        }
        
        if include_debug:
            error_data.update({
                "debug_info": {
                    "context": self.context,
                    "stack_trace": self.original_exception
                }
            })
        
        super().__init__(status_code=status_code, detail=error_data)

class PatientNotFoundException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "Patient not found",
        patient_id: Optional[str] = None,
        include_debug: bool = False
    ):
        context = {"patient_id": patient_id} if patient_id else {}
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="DOCTOR-001",
            context=context,
            include_debug=include_debug
        )

class LabRequestNotFoundException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "Lab request not found",
        request_id: Optional[str] = None,
        include_debug: bool = False
    ):
        context = {"request_id": request_id} if request_id else {}
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="DOCTOR-003",
            context=context,
            include_debug=include_debug
        )

class DatabaseException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "Database operation failed",
        operation: Optional[str] = None,
        query: Optional[str] = None,
        include_debug: bool = False
    ):
        context = {
            "operation": operation,
            "query_snippet": query[:100] + "..." if query else None
        }
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="DOCTOR-006",
            context=context,
            include_debug=include_debug
        )

# Preserve original exception classes with enhanced functionality
class AppointmentNotFoundException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "Appointment not found",
        appointment_id: Optional[str] = None,
        include_debug: bool = False
    ):
        context = {"appointment_id": appointment_id} if appointment_id else {}
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="DOCTOR-002",
            context=context,
            include_debug=include_debug
        )

class ReportGenerationException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "Report generation failed",
        report_type: Optional[str] = None,
        include_debug: bool = False
    ):
        context = {"report_type": report_type} if report_type else {}
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="DOCTOR-004",
            context=context,
            include_debug=include_debug
        )

class AIModelException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "AI model processing failed",
        model_name: Optional[str] = None,
        include_debug: bool = False
    ):
        context = {"model_name": model_name} if model_name else {}
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="DOCTOR-005",
            context=context,
            include_debug=include_debug
        )

class UnauthorizedException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "Not authorized to perform this action",
        required_roles: Optional[List[str]] = None,
        include_debug: bool = False
    ):
        context = {"required_roles": required_roles} if required_roles else {}
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="DOCTOR-007",
            context=context,
            include_debug=include_debug
        )

class ResourceNotFoundException(DoctorServiceException):
    def __init__(
        self, 
        detail: str = "Requested resource not found",
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        include_debug: bool = False
    ):
        context = {
            "resource_type": resource_type,
            "resource_id": resource_id
        }
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="DOCTOR-008",
            context=context,
            include_debug=include_debug
        )
        
# doctor_service/app/exceptions.py (add if missing)
from fastapi import HTTPException, status

class BadRequestException(HTTPException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": message,
                "details": details or {}
            }
        )

class DatabaseException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail
        )
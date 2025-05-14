from pydantic import BaseModel, Field, UUID4, validator, root_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
from fastapi import HTTPException
import uuid
import re
from .models import TestType, TestPriority, TestStatus, NotificationType

# labroom_service/app/models.py
# Update these enums if needed

class TestType(str, Enum):
    COMPLETE_BLOOD_COUNT = "complete_blood_count"
    COMPREHENSIVE_METABOLIC_PANEL = "comprehensive_metabolic_panel"
    LIPID_PANEL = "lipid_panel"
    LIVER_FUNCTION_TEST = "liver_function_test"
    THYROID_PANEL = "thyroid_panel"
    URINALYSIS = "urinalysis"
    HBA1C = "hba1c"
    CHEST_XRAY = "chest_xray"
    ECG = "ecg"
    COVID19_TEST = "covid19_test"
    ALLERGY_TEST = "allergy_test"
    VITAMIN_D_TEST = "vitamin_d_test"
    

@validator('test_type')
def validate_test_type(cls, value):
    try:
        return TestType(value)
    except ValueError:
        valid_types = ", ".join([e.value for e in TestType])
        raise HTTPException(
            status_code=400,
            detail=f"Invalid test type. Valid values are: {valid_types}"
        )

class TestPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    # Ensure these match the urgency levels in doctor_service

# Common status response
class StatusResponse(BaseModel):
    status: str
    message: str

class UserSync(BaseModel):
    id: UUID4
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    is_active: bool = True

# Lab Request schemas
class LabRequestBase(BaseModel):
    patient_id: UUID4
    doctor_id: UUID4
    test_type: TestType
    priority: TestPriority = TestPriority.MEDIUM
    notes: Optional[str] = None
    diagnosis_notes: Optional[str] = None
    due_date: Optional[datetime] = None

    @validator('notes', 'diagnosis_notes')
    def validate_text_fields(cls, v):
        if v and len(v) > 2000:
            raise ValueError('Text field too long, maximum 2000 characters')
        return v

class LabRequestCreate(LabRequestBase):
    pass

class LabRequestUpdate(BaseModel):
    technician_id: Optional[UUID4] = None
    status: Optional[TestStatus] = None
    notes: Optional[str] = None
    diagnosis_notes: Optional[str] = None
    priority: Optional[TestPriority] = None
    due_date: Optional[datetime] = None
    
    @validator('status')
    def validate_status(cls, v, values):
        if v == TestStatus.COMPLETED and not values.get('technician_id'):
            raise ValueError('Cannot mark a request as completed without a technician')
        return v
    
    @validator('notes', 'diagnosis_notes')
    def validate_text_fields(cls, v):
        if v and len(v) > 2000:
            raise ValueError('Text field too long, maximum 2000 characters')
        return v

# app/schemas.py updates
from pydantic import BaseModel, Field, UUID4, validator, root_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
from fastapi import HTTPException
import uuid
import re
from .models import TestType, TestPriority, TestStatus, NotificationType

# Add these fields to LabRequestResponse
class LabRequestResponse(LabRequestBase):
    id: UUID4
    technician_id: Optional[UUID4] = None
    status: TestStatus
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    is_read: bool = False
    read_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
class AnalyticsMetrics(BaseModel):
    total_requests_today: int = 0
    pending_requests: int = 0
    completed_requests: int = 0
    unread_requests: int = 0
    average_response_time: float = 0  # in hours

class AnalyticsResponse(BaseModel):
    success: bool = True
    metrics: AnalyticsMetrics
    status_breakdown: Dict[str, int] = {}
    priority_breakdown: Dict[str, int] = {}
    daily_requests: List[Dict[str, Any]] = []
    test_type_breakdown: List[Dict[str, Any]] = []
    
# Add new schema for History
class LabRequestEvent(BaseModel):
    id: UUID4
    lab_request_id: UUID4
    event_type: str
    event_timestamp: datetime
    user_id: Optional[UUID4] = None
    details: Optional[Dict[str, Any]] = None

class LabRequestHistoryResponse(BaseModel):
    success: bool = True
    events: List[LabRequestEvent]
    
# Add schema for Report Generation
class ReportGenerateRequest(BaseModel):
    report_type: str = Field(..., description="Type of report (weekly, monthly, custom)")
    format: str = Field("csv", description="Output format (csv, pdf)")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_metrics: List[str] = ["all"]

class ReportResponse(BaseModel):
    success: bool = True
    report_id: UUID4
    report_url: str
    report_type: str
    format: str
    generated_at: datetime

class LabRequestDetailResponse(LabRequestResponse):
    # Include additional information for detailed view
    patient_details: Optional[Dict[str, Any]] = None
    doctor_details: Optional[Dict[str, Any]] = None
    technician_details: Optional[Dict[str, Any]] = None
    lab_result: Optional[Dict[str, Any]] = None

# Lab Result schemas
class LabResultBase(BaseModel):
    lab_request_id: UUID4
    result_data: Dict[str, Any] = Field(default_factory=dict)
    conclusion: Optional[str] = None

    @validator('conclusion')
    def validate_conclusion(cls, v):
        if v and len(v) > 2000:
            raise ValueError('Conclusion too long, maximum 2000 characters')
        return v
    
    @validator('result_data')
    def validate_result_data(cls, v):
        # Ensure result_data is a valid nested JSON structure
        try:
            import json
            json.dumps(v)
            return v
        except TypeError:
            raise ValueError('result_data must be a valid JSON structure')

class LabResultCreate(LabResultBase):
    pass

class LabResultUpdate(BaseModel):
    result_data: Optional[Dict[str, Any]] = None
    conclusion: Optional[str] = None
    
    @validator('conclusion')
    def validate_conclusion(cls, v):
        if v and len(v) > 2000:
            raise ValueError('Conclusion too long, maximum 2000 characters')
        return v

class LabResultResponse(LabResultBase):
    id: UUID4
    image_paths: List[str] = []
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class LabResultDetailResponse(LabResultResponse):
    lab_request: Optional[Dict[str, Any]] = None
    patient_details: Optional[Dict[str, Any]] = None
    doctor_details: Optional[Dict[str, Any]] = None

# Notification schemas
class NotificationBase(BaseModel):
    recipient_id: UUID4
    sender_id: UUID4
    lab_request_id: Optional[UUID4] = None
    lab_result_id: Optional[UUID4] = None
    title: str
    message: str
    notification_type: NotificationType

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: UUID4
    is_read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# WebSocket message schemas
class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any]

# File upload schemas
class ImageUploadResponse(BaseModel):
    file_path: str
    file_name: str
    file_size: int
    content_type: str

# Pagination response wrapper
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int

# Lab history query params
class LabHistoryParams(BaseModel):
    technician_id: Optional[UUID4] = None
    status: Optional[TestStatus] = None
    test_type: Optional[TestType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    size: int = 10
    

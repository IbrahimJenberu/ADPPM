"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field, EmailStr, validator, UUID4
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum
import json

# Enums
class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"

class BloodGroup(str, Enum):
    A_POSITIVE = "A+"
    A_NEGATIVE = "A-"
    B_POSITIVE = "B+"
    B_NEGATIVE = "B-"
    AB_POSITIVE = "AB+"
    AB_NEGATIVE = "AB-"
    O_POSITIVE = "O+"
    O_NEGATIVE = "O-"

class AppointmentStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"

class AppointmentType(str, Enum):
    INITIAL = "INITIAL"
    FOLLOW_UP = "FOLLOW_UP"
    PROCEDURE = "PROCEDURE"
    CONSULTATION = "CONSULTATION"
    EMERGENCY = "EMERGENCY"

class OPDPriority(str, Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"

class OPDStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    TRANSFERRED = "TRANSFERRED"
    CANCELLED = "CANCELLED"

# Base models
class BaseResponse(BaseModel):
    success: bool = True
    message: str = "Operation successful"

class PaginatedResponse(BaseResponse):
    total: int
    page: int
    page_size: int
    pages: int
    
    @validator('pages', pre=True, always=True)
    def calculate_pages(cls, v, values):
        if 'total' in values and 'page_size' in values and values['page_size'] > 0:
            return (values['total'] + values['page_size'] - 1) // values['page_size']
        return 0

# Patient models
class PatientBase(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: date
    gender: Gender
    blood_group: Optional[BloodGroup] = None
    phone_number: str = Field(..., min_length=10, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[List[str]] = Field(default_factory=list)
    medical_history: Optional[Dict[str, Any]] = Field(default_factory=dict)


    @validator('date_of_birth')
    def validate_birth_date(cls, v):
        if v > datetime.now().date():
            raise ValueError("Date of birth cannot be in the future")
        return v

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(None, min_length=2, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[BloodGroup] = None
    phone_number: Optional[str] = Field(None, min_length=10, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical_history: Optional[Dict[str, Any]] = None

class PatientResponse(PatientBase):
    id: UUID4
    registration_number: str
    medical_history: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    
    @validator('allergies', 'medical_history', pre=True)
    def parse_json_fields(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [] if 'allergies' in cls.__fields__ else {}
        return v or ([] if 'allergies' in cls.__fields__ else {})

class PatientSearchParams(BaseModel):
    query: Optional[str] = None
    page: int = 1
    page_size: int = 20

class PatientsResponse(BaseModel):
    success: bool = True
    message: str = "Operation successful"
    total: int
    page: int
    page_size: int
    pages: int  # This was missing
    data: List[PatientResponse]

# OPD Assignment models
class OPDAssignmentBase(BaseModel):
    patient_id: UUID4
    doctor_id: UUID4
    priority: OPDPriority = OPDPriority.NORMAL
    notes: Optional[str] = None

class OPDAssignmentCreate(OPDAssignmentBase):
    pass

class OPDAssignmentUpdate(BaseModel):
    doctor_id: Optional[UUID4] = None
    priority: Optional[OPDPriority] = None
    status: Optional[OPDStatus] = None
    notes: Optional[str] = None

class OPDAssignmentResponse(OPDAssignmentBase):
    id: UUID4
    status: OPDStatus
    created_at: datetime
    updated_at: datetime
    
    # Joined fields
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None  # Changed from department to match join
    patient_name: Optional[str] = None
    patient_registration: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "patient_id": "550e8400-e29b-41d4-a716-446655440000",
                "doctor_id": "550e8400-e29b-41d4-a716-446655440000",
                "priority": "NORMAL",
                "status": "PENDING",
                "notes": "Patient requires urgent care",
                "created_at": "2023-04-20T12:00:00Z",
                "updated_at": "2023-04-20T12:00:00Z",
                "doctor_name": "Dr. Jane Smith",
                "doctor_specialty": "Cardiology",
                "patient_name": "John Doe",
                "patient_registration": "P-12345"
            }
        }

class OPDAssignmentsResponse(PaginatedResponse):
    data: List[OPDAssignmentResponse]

# Appointment models
class AppointmentBase(BaseModel):
    patient_id: UUID4
    doctor_id: UUID4
    appointment_date: datetime
    duration_minutes: int = Field(30, ge=15, le=120)
    appointment_type: AppointmentType
    reason: Optional[str] = None
    notes: Optional[str] = None

# In your schemas.py, modify the AppointmentCreate and Update classes:

from datetime import timezone  # Add this import

class AppointmentCreate(AppointmentBase):
    
    @validator('appointment_date')
    def validate_appointment_date(cls, v):
        # Compare with timezone-aware datetime
        if v < datetime.now(timezone.utc):
            raise ValueError("Appointment date cannot be in the past")
        return v

class AppointmentUpdate(BaseModel):
    appointment_date: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=120)
    appointment_type: Optional[AppointmentType] = None
    status: Optional[AppointmentStatus] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    
    @validator('appointment_date')
    def validate_appointment_date(cls, v):
        if v and v < datetime.now(timezone.utc):
            raise ValueError("Appointment date cannot be in the past")
        return v

# cardroom_service/app/schemas.py
class AppointmentResponse(AppointmentBase):
    id: UUID4
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime
    doctor_name: str
    doctor_specialty: str = Field(..., alias="department")
    patient_name: str
    patient_registration: str = Field(..., alias="patient_registration")

    class Config:
        populate_by_name = True  # Updated from allow_population_by_field_name
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        
class AppointmentsResponse(PaginatedResponse):
    data: List[AppointmentResponse]

class AppointmentDateRange(BaseModel):
    start_date: datetime
    end_date: datetime
    
    @validator('end_date')
    def validate_end_date(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError("End date must be after start date")
        return v

# Doctor models (minimal for reference)
class DoctorResponse(BaseModel):
    id: UUID4
    full_name: str
    specialty: str
    is_available: bool

class DoctorsResponse(PaginatedResponse):
    data: List[DoctorResponse]

# Notification schemas
class NotificationCreate(BaseModel):
    recipient_id: UUID4
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID4] = None

class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any]
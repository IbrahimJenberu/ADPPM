# doctor_service/app/schemas.py
import uuid
from uuid import UUID
from typing import List, Optional, Dict, Any, Union
from datetime import date, datetime, time
from pydantic import BaseModel, Field, validator, EmailStr, UUID4
import numpy as np # Add numpy import for NaN handling

# Base schemas
class BaseResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None

# Add this in the Appointment schemas section before AppointmentBase
class AppointmentDateRange(BaseModel):
    start_date: date
    end_date: date

# Doctor schemas
class DoctorBase(BaseModel):
    full_name: str
    specialization: str

class DoctorInfo(DoctorBase):
    id: uuid.UUID
    email: EmailStr
    created_at: datetime
    updated_at: Optional[datetime] = None

# Patient schemas
class PatientBase(BaseModel):
    registration_number: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone_number: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical_history: Optional[Dict[str, Any]] = None
    
    @validator('phone_number')
    def validate_phone_number(cls, v):
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Phone number must have at least 5 digits")
        if not v.isdigit():
            raise ValueError("Phone number must contain only digits")
        return v

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical_conditions: Optional[List[str]] = None

class PatientInfo(PatientBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_deleted: Optional[bool] = None

class CardroomPatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone_number: str
    email: str | None
    address: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    blood_group: str | None
    allergies: list[str] | None
    medical_history: dict | None

    @validator('date_of_birth', pre=True)
    def parse_date(cls, value):
        if isinstance(value, str):
            try:
                return datetime.strptime(value, '%Y-%m-%d').date()
            except ValueError:
                try:
                    return datetime.strptime(value, '%d/%m/%Y').date()
                except ValueError as e:
                    raise ValueError(f"Invalid date format: {value}") from e
        return value

# Medical Record schemas
class VitalSigns(BaseModel):
    blood_pressure: Optional[str] = None
    heart_rate: Optional[int] = None
    respiratory_rate: Optional[int] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    height: Optional[float] = None
    weight: Optional[float] = None

class MedicalRecordCreate(BaseModel):
    diagnosis: str
    treatment: Optional[str] = None
    notes: Optional[str] = None
    medications: Optional[List[str]] = None
    vital_signs: Optional[VitalSigns] = None
    follow_up_date: Optional[date] = None

class MedicalRecordInfo(MedicalRecordCreate):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
class MedicalRecordUpdate(BaseModel):
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    notes: Optional[str] = None
    medications: Optional[List[str]] = None
    vital_signs: Optional[VitalSigns] = None
    follow_up_date: Optional[date] = None

class MedicalRecordListResponse(BaseResponse):
    records: List[MedicalRecordInfo]

# Patient status timeline schemas
class PatientStatusEntry(BaseModel):
    """A single entry in the patient's status timeline"""
    status: str
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class PatientStatusTimelineResponse(BaseResponse):
    """Response containing the patient's complete status timeline"""
    timeline: List[PatientStatusEntry]


class UserSync(BaseModel):
    id: UUID4
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    is_active: bool = True

# doctor_service/app/schemas.py (ensure response model matches)
from datetime import datetime


class AppointmentResponse(BaseModel):
    id: UUID
    patient_id: UUID
    doctor_id: UUID
    appointment_datetime: datetime
    duration_minutes: int
    appointment_type: str
    status: str
    reason: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    patient_name: str
    doctor_name: str

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

# Remove the conflicting AppointmentResponse that had 'appointment' field

# Lab Request schemas
class LabRequestCreate(BaseModel):
    patient_id: uuid.UUID
    test_type: str
    urgency: str = Field(..., description="high, medium, or low")
    notes: Optional[str] = None
    
    @validator('urgency')
    def validate_urgency(cls, v):
        if v not in ['high', 'medium', 'low']:
            raise ValueError('Urgency must be high, medium, or low')
        return v

class LabRequestInfo(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: Optional[str] = None
    doctor_id: uuid.UUID
    test_type: str
    urgency: str
    notes: Optional[str] = None
    status: str
    result: Optional[str] = None
    result_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

# Appointment schemas
# Appointment schemas
class AppointmentBase(BaseModel):
    patient_id: uuid.UUID
    appointment_date: date
    appointment_time: time
    duration_minutes: int = 30
    reason: Optional[str] = None
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    status: str = Field(..., description="SCHEDULED, CONFIRMED, COMPLETED, CANCELLED, or NO_SHOW")
    notes: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']
        v_upper = v.upper()
        if v_upper not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v_upper

class AppointmentInfo(AppointmentBase):
    id: uuid.UUID
    doctor_id: uuid.UUID
    patient_name: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

# AI Diagnosis schemas
class ChestXrayAnalysisRequest(BaseModel):
    patient_id: uuid.UUID
    image_data: str = Field(..., description="Base64 encoded image")
    additional_notes: Optional[str] = None

class BrainMRIAnalysisRequest(BaseModel):
    patient_id: uuid.UUID
    image_data: str = Field(..., description="Base64 encoded image")
    additional_notes: Optional[str] = None

class SymptomAnalysisRequest(BaseModel):
    patient_id: uuid.UUID
    symptoms: List[str]
    symptom_duration: Optional[int] = None
    additional_notes: Optional[str] = None

class AIAnalysisResult(BaseModel):
    prediction: str
    confidence: float
    possible_conditions: List[Dict[str, Any]]
    recommendation: Optional[str] = None

# Medical Report schemas
class MedicalReportCreate(BaseModel):
    patient_id: uuid.UUID
    diagnosis: str
    treatment: str
    prescriptions: List[str]
    observations: Optional[str] = None
    recommendations: Optional[str] = None
    format_type: str = Field('pdf', description="pdf or text")
    
    @validator('format_type')
    def validate_format_type(cls, v):
        if v not in ['pdf', 'text']:
            raise ValueError('Format type must be pdf or text')
        return v

class MedicalReportInfo(MedicalReportCreate):
    id: uuid.UUID
    doctor_id: uuid.UUID
    doctor_name: Optional[str] = None
    created_at: datetime
    report_url: Optional[str] = None

# Notification schemas
class NotificationInfo(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    notification_type: Optional[str] = None  # Made optional
    related_id: uuid.UUID
    is_read: bool
    created_at: datetime

# Response schemas
class PatientResponse(BaseResponse):
    patient: Optional[PatientInfo] = None

class PatientsListResponse(BaseResponse):
    message: Optional[str] = "Patients retrieved successfully"
    patients: List[PatientInfo]
    total: int

class MedicalRecordResponse(BaseResponse):
    record: Optional[MedicalRecordInfo] = None

class MedicalRecordsListResponse(BaseResponse):
    records: List[MedicalRecordInfo]
    total: int

class LabRequestResponse(BaseResponse):
    lab_request: Optional[LabRequestInfo] = None

class LabRequestsListResponse(BaseResponse):
    lab_requests: List[LabRequestInfo]
    total: int

class AppointmentsListResponse(BaseResponse):
    appointments: List[AppointmentResponse]
    total: int

# doctor_service/app/schemas.py
# Add this to your existing schemas.py file

class LabResultNotification(BaseModel):
    lab_request_id: uuid.UUID
    lab_result_id: uuid.UUID
    doctor_id: uuid.UUID
    test_type: str
    conclusion: Optional[str] = None
    result_summary: Optional[Dict[str, Any]] = None
    created_at: datetime

# Add this to your schemas.py
class AppointmentUpdateResponse(BaseResponse):
    appointment: AppointmentResponse

class AIAnalysisResponse(BaseResponse):
    result: Optional[AIAnalysisResult] = None

class MedicalReportResponse(BaseResponse):
    report: Optional[MedicalReportInfo] = None
    
class MedicalReportsListResponse(BaseResponse):
    reports: List[MedicalReportInfo]
    total: int

class NotificationsListResponse(BaseResponse):
    notifications: List[NotificationInfo]
    total: int
    
class NotificationCreate(BaseModel):
    recipient_id: UUID4
    message: Optional[str] = None
    notification_type: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID4] = None

class NotificationResponse(NotificationCreate):
    id: UUID4
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

class NotificationsResponse(BaseResponse):
    data: List[NotificationResponse]
    total: int
    page: int
    page_size: int
    
# doctor_service/app/schemas.py

class ExternalPatient(BaseModel):
    id: uuid.UUID
    registration_number: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[str]
    phone_number: Optional[str]
    email: Optional[EmailStr] = None
    address: Optional[str] = None

class PatientsListResponse(BaseResponse):
    patients: List[ExternalPatient]


# app/schemas.py - Add these to your schemas.py file

class LabRequestCommentCreate(BaseModel):
    comment: str
    is_private: bool = False

class LabRequestCommentResponse(BaseResponse):
    comment: Dict[str, Any]
    
class LabRequestFileResponse(BaseResponse):
    file: Dict[str, Any]
    
class LabRequestUpdate(BaseModel):
    notes: Optional[str] = None
    urgency: Optional[str] = None
    
class LabRequestDetailResponse(BaseResponse):
    lab_request: Dict[str, Any]
    
class LabRequestAnalyticsSummary(BaseResponse):
    date_range: Dict[str, str]
    status_counts: Dict[str, int]
    test_type_counts: List[Dict[str, Any]]
    urgency_counts: Dict[str, int]
    trend_data: List[Dict[str, Any]]
    average_turnaround_hours: float
    


class SymptomInputData(BaseModel):
    """ Defines the input fields expected for symptom-based diagnosis. """
    # Ensure ALL fields used during training are listed here.
    # Use Optional[...] = Field(DEFAULT_VALUE, ...)
    # Use Field(..., ge=0, le=1) for binary flags

    # Demographics
    age: Optional[int] = Field(None, description="Patient age in years")
    gender_code: Optional[int] = Field(None, description="0=Female, 1=Male", ge=0, le=1)
    region_code: Optional[int] = Field(None, description="Code for geographical region")

    # Symptoms (Default to 0 = No if not provided)
    symptom_abdominal_pain: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_blood_in_sputum: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_body_aches: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_chest_pain: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_chills: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_congestion: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_constipation: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_cough: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_confusion: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_dehydration: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_diarrhea: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_difficulty_breathing: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_extreme_pain: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_fast_heart_rate: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_fatigue: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_fever: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_headache: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_jaundice: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_loss_of_appetite: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_low_blood_pressure_symptom: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_nausea: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_neck_stiffness: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_night_sweats: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_rash: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_runny_nose: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_seizures: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_sensitivity_to_light: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_sneezing: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_sore_throat: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_sweating: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_swollen_lymph_nodes: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_vomiting: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_weakness: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_weight_loss: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    symptom_wheezing: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1) # Assuming wheezing was trained? Add if yes.

    # Temporal (Allow None, pipeline should handle)
    symptom_duration_days: Optional[int] = Field(None, description="Duration of symptoms in days", ge=0)
    symptom_onset_days: Optional[int] = Field(None, description="Days since first symptom appeared", ge=0)
    symptoms_worsening: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)

    # Comorbidities (Default to 0 = No)
    comorbidity_asthma: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    comorbidity_diabetes: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    comorbidity_heart_disease: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    comorbidity_hiv: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    comorbidity_hypertension: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    comorbidity_kidney_disease: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)
    comorbidity_obesity: Optional[int] = Field(0, description="0=No, 1=Yes", ge=0, le=1)

    # Vitals (Allow None, pipeline imputes)
    vital_temperature: Optional[float] = Field(None, description="Body temperature in Celsius")
    vital_heart_rate: Optional[int] = Field(None, description="Heart rate in beats per minute", ge=0)
    vital_respiratory_rate: Optional[int] = Field(None, description="Respiratory rate in breaths per minute", ge=0)
    vital_oxygen_saturation: Optional[int] = Field(None, description="Oxygen saturation percentage", ge=0, le=100)

    # Handle potential NaN floats coming from JSON nulls
    @validator('*', pre=True, allow_reuse=True)
    def check_nan(cls, v):
        if isinstance(v, float) and np.isnan(v):
            return None # Convert NaN float to None
        return v

    # Ensure binary fields are 0 or 1 if provided
    @validator('gender_code', 'symptoms_worsening', 'symptom_fever', 'symptom_cough', 'symptom_headache',
               'symptom_chills', 'symptom_sweating', 'symptom_fatigue', 'symptom_nausea', 'symptom_vomiting',
               'symptom_body_aches', 'symptom_jaundice', 'symptom_blood_in_sputum', 'symptom_chest_pain',
               'symptom_night_sweats', 'symptom_weight_loss', 'symptom_loss_of_appetite', 'symptom_weakness',
               'symptom_abdominal_pain', 'symptom_constipation', 'symptom_diarrhea', 'symptom_rash',
               'symptom_difficulty_breathing', 'symptom_confusion', 'symptom_neck_stiffness',
               'symptom_sensitivity_to_light', 'symptom_seizures', 'symptom_dehydration',
               'symptom_swollen_lymph_nodes', 'symptom_sore_throat', 'symptom_runny_nose',
               'symptom_sneezing', 'symptom_congestion', 'symptom_fast_heart_rate',
               'symptom_low_blood_pressure_symptom', 'symptom_extreme_pain', 'symptom_wheezing', # Add any others
               'comorbidity_diabetes', 'comorbidity_hypertension', 'comorbidity_hiv', 'comorbidity_asthma',
               'comorbidity_heart_disease', 'comorbidity_obesity', 'comorbidity_kidney_disease',
               allow_reuse=True)
    def check_binary(cls, v):
        if v is not None and v not in [0, 1]:
            raise ValueError('Binary field must be 0, 1, or null')
        return v

    class Config:
        extra = 'ignore' # Ignore extra fields not defined here


class SymptomPredictionValidationFlag(BaseModel):
    type: str
    message: str

class SymptomPredictionValidationAlert(BaseModel):
    type: str
    message: str

class SymptomPredictionValidationResult(BaseModel):
    valid: bool
    flags: List[SymptomPredictionValidationFlag]
    alerts: List[SymptomPredictionValidationAlert]
    original_severity: str
    adjusted_severity: Optional[str] = None
    message: Optional[str] = None


class SymptomPredictionResult(BaseModel):
    disease: str
    probability: float = Field(..., ge=0.0, le=1.0)
    severity: str
    severity_score: Optional[float] = None # Made optional as it could be None
    validation: SymptomPredictionValidationResult
    explanation: Optional[Dict[str, Any]] = Field(None, description="SHAP explanations (if requested)")

class SymptomAIAnalysisResponse(BaseModel):
     success: bool
     message: str
     result: Optional[SymptomPredictionResult] = None # Contains the detailed prediction

# Ensure AIAnalysisResponse is generic enough or remove if unused by symptoms endpoint
class AIAnalysisResponseResult(BaseModel):
    details: Dict[str, Any] | List[Dict[str, Any]] | str # Flexible result field

class AIAnalysisResponse(BaseModel):
    success: bool
    message: str
    result: Optional[AIAnalysisResponseResult | Dict[str, Any] | List[Dict[str, Any]]] = None
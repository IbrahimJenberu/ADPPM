# doctor_service/app/services/cardroom_service.py

import httpx
import asyncio
import time
import logging
from datetime import date
import uuid
from uuid import UUID
from typing import List, Dict, Any, Optional, Tuple
from asyncpg import Pool
from fastapi import HTTPException
from functools import lru_cache
from datetime import datetime, timedelta
from app.models import Patient
from app.config import settings
from app.database import get_app_pool  # Import the app-level pool


logger = logging.getLogger(__name__)

# Connection pool for HTTP requests with sensible defaults
http_client = httpx.AsyncClient(
    timeout=10.0,
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    transport=httpx.AsyncHTTPTransport(retries=3)
)

# In-memory cache for patient data
CACHE = {}
CACHE_TTL = 300  # seconds
CACHE_LOCK = asyncio.Lock()
_SYNC_IN_PROGRESS = {}  # Track ongoing syncs by doctor_id

# Circuit breaker for resilience
class CircuitBreaker:
    def __init__(self, name, failure_threshold=5, recovery_time=30):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failures = 0
        self.open_since = None
        
    async def execute(self, func, *args, **kwargs):
        # Check if circuit is open
        if self.open_since and (datetime.now() - self.open_since).total_seconds() < self.recovery_time:
            logger.warning(f"Circuit {self.name} is open, rejecting request")
            raise HTTPException(status_code=503, detail=f"Service {self.name} temporarily unavailable")
            
        try:
            result = await func(*args, **kwargs)
            # Reset failures on success
            self.failures = 0
            self.open_since = None
            return result
        except Exception as e:
            # Increment failures
            self.failures += 1
            logger.error(f"Circuit {self.name} failure: {str(e)}")
            
            # Open circuit if threshold reached
            if self.failures >= self.failure_threshold:
                self.open_since = datetime.now()
                logger.warning(f"Circuit {self.name} opened due to {self.failures} failures")
                
            raise

# Create circuit breaker for cardroom service
cardroom_circuit = CircuitBreaker("cardroom_service")

# Handle background database operations safely
async def _safe_db_operation(func, *args, **kwargs):
    """Execute database operations with proper pool handling for background tasks"""
    pool = None
    try:
        # Get the application-level pool, not the request-scoped one
        pool = await get_app_pool()
        return await func(pool, *args, **kwargs)
    except Exception as e:
        logger.error(f"Database operation failed: {str(e)}")
        return None

async def get_patient_details(patient_id: UUID, request_pool=None) -> dict:
    """Fetch patient details with cache support"""
    cache_key = f"patient:{str(patient_id)}"
    
    # Try cache first for better performance
    cached_data = CACHE.get(cache_key)
    if cached_data and (datetime.now() - cached_data['timestamp']).total_seconds() < CACHE_TTL:
        logger.debug(f"Cache hit for patient {patient_id}")
        return cached_data['data']
    
    # Not in cache, fetch from cardroom service
    try:
        response = await http_client.get(
            f"{settings.CARDROOM_SERVICE_URL}/api/patients/{patient_id}"
        )
        response.raise_for_status()
        patient_data = response.json()
        
        # Store in cache
        CACHE[cache_key] = {
            'data': patient_data,
            'timestamp': datetime.now()
        }
        
        # Store in database without awaiting result
        # Use a safe background task that handles its own pool
        asyncio.create_task(
            _safe_db_operation(Patient.upsert_patient, patient_data)
        )
            
        return patient_data
        
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        logger.error(f"HTTP error fetching patient {patient_id}: {str(e)}")
        
        # Fallback to local database if available
        try:
            pool = request_pool or await get_app_pool()
            patient = await Patient.get_by_id(pool, patient_id)
            if patient:
                return patient
        except Exception as db_error:
            logger.error(f"Database fallback error: {str(db_error)}")
        
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Cardroom service error: {e.response.text}"
        )
    except Exception as e:
        logger.error(f"Error fetching patient {patient_id}: {str(e)}")
        
        # Fallback to local database if available
        try:
            pool = request_pool or await get_app_pool()
            patient = await Patient.get_by_id(pool, patient_id)
            if patient:
                return patient
        except Exception as db_error:
            logger.error(f"Database fallback error: {str(db_error)}")
            
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch patient data: {str(e)}"
        )

async def get_assigned_patients(doctor_id: UUID, request_pool=None) -> List[Dict[str, Any]]:
    """Fetch all patients assigned to a doctor efficiently using batched requests"""
    doctor_id_str = str(doctor_id)
    
    # Prevent duplicate sync requests for the same doctor
    if _SYNC_IN_PROGRESS.get(doctor_id_str):
        logger.info(f"Sync already in progress for doctor {doctor_id}, using local data")
        return await get_local_patients(doctor_id, request_pool)
    
    try:
        _SYNC_IN_PROGRESS[doctor_id_str] = True
        
        # Try to use optimized batch endpoint
        try:
            batch_url = f"{settings.CARDROOM_SERVICE_URL}/api/opd-assignments/doctor/{doctor_id}/patients"
            logger.info(f"Fetching patients in batch from {batch_url}")
            
            response = await http_client.get(batch_url, timeout=15.0)
            response.raise_for_status()
            patients = response.json()
            
            # Cache and store each patient
            for patient in patients:
                cache_key = f"patient:{patient['id']}"
                CACHE[cache_key] = {
                    'data': patient,
                    'timestamp': datetime.now()
                }
                # Store in DB without awaiting, using safe background task
                asyncio.create_task(
                    _safe_db_operation(Patient.upsert_patient, patient)
                )
            
            logger.info(f"Successfully fetched {len(patients)} patients in batch")
            return patients
            
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            # Batch endpoint failed or not implemented, fallback to traditional method
            logger.warning(f"Batch endpoint failed, using fallback method: {str(e)}")
            
            # Get assignments via schedule endpoint
            schedule_url = f"{settings.CARDROOM_SERVICE_URL}/api/opd-assignments/doctor/{doctor_id}/schedule"
            logger.info(f"Fetching assignments from {schedule_url}")
            
            response = await http_client.get(schedule_url)
            response.raise_for_status()
            assignments = response.json()
            
            # Get unique patient IDs from assignments
            patient_ids = set(assignment.get('patient_id') for assignment in assignments if assignment.get('patient_id'))
            
            # Batch process patients with concurrency limit
            patients = []
            semaphore = asyncio.Semaphore(5)  # Limit concurrent requests
            
            async def fetch_with_limit(pid):
                async with semaphore:
                    return await get_patient_details(pid, request_pool)
            
            # Create tasks for all patient IDs
            tasks = [fetch_with_limit(pid) for pid in patient_ids]
            
            # Process results as they complete
            for completed_task in asyncio.as_completed(tasks):
                try:
                    patient = await completed_task
                    if patient:
                        patients.append(patient)
                except Exception as task_error:
                    logger.error(f"Error in patient batch processing: {str(task_error)}")
            
            logger.info(f"Fetched {len(patients)} patients via fallback method")
            return patients
            
    except Exception as e:
        logger.error(f"Failed to fetch patients for doctor {doctor_id}: {str(e)}")
        # Fallback to local database
        return await get_local_patients(doctor_id, request_pool)
    finally:
        # Clear sync flag when done
        _SYNC_IN_PROGRESS.pop(doctor_id_str, None)

async def get_local_patients(doctor_id: UUID, request_pool=None) -> List[Dict[str, Any]]:
    """Get patients from local database only"""
    try:
        pool = request_pool or await get_app_pool()
        patients = await Patient.get_assigned_patients(pool, doctor_id)
        logger.info(f"Retrieved {len(patients)} patients from local database")
        return patients
    except Exception as e:
        logger.error(f"Error retrieving patients from local database: {str(e)}")
        return []

# Function to trigger background sync without waiting
def trigger_background_sync(doctor_id: UUID):
    """Start background sync for a doctor without waiting"""
    asyncio.create_task(_background_sync(doctor_id))

async def _background_sync(doctor_id: UUID):
    """Background task to sync patients for a doctor"""
    try:
        # Use app-level pool for background tasks
        await get_assigned_patients(doctor_id)
        logger.info(f"Background sync completed for doctor {doctor_id}")
    except Exception as e:
        logger.error(f"Background sync failed: {str(e)}")

# Clean up HTTP client on application shutdown
async def cleanup():
    await http_client.aclose()

# Background task for syncing
async def background_sync_patients(pool: Pool, doctor_id: UUID):
    """Background task to sync patients for a doctor"""
    logger.info(f"Starting background sync for doctor {doctor_id}")
    try:
        await get_assigned_patients(doctor_id, pool)
        logger.info(f"Background sync completed for doctor {doctor_id}")
    except Exception as e:
        logger.error(f"Background sync failed: {str(e)}")

        
# doctor_service/app/services/cardroom_service.py
async def get_doctor_appointments_from_cardroom(
    doctor_id: uuid.UUID, 
    start_date: date, 
    end_date: date
):
    """Fetch appointments from Cardroom Service"""
    url = f"http://cardroom_service:8023/api/appointments/doctor/{doctor_id}/schedule"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Cardroom service error: {e.response.text}"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cardroom service unreachable: {str(e)}"
        )
        
# Add to services/cardroom_service.py
async def update_cardroom_appointment(
    appointment_id: UUID, 
    status: str,
    notes: Optional[str] = None
):
    """Update appointment in Cardroom Service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"http://cardroom_service:8023/api/appointments/{appointment_id}",
                json={"status": status, "notes": notes}
            )
            response.raise_for_status()
            return response.json()
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Cardroom update failed: {e.response.text}"
        )

# Add to services/cardroom_service.py
async def get_single_appointment_from_cardroom(
    appointment_id: UUID
):
    """Get single appointment directly from Cardroom Service"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://cardroom_service:8023/api/appointments/{appointment_id}"
            )
            response.raise_for_status()
            return response.json()
            
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Cardroom service error: {e.response.text}"
        )

from ..schemas import PatientStatusEntry
from datetime import datetime

# Enhanced get_patient_registration_event function with better error handling

async def get_patient_registration_event(patient_id: UUID) -> Optional[PatientStatusEntry]:
    """Fetch patient registration event from cardroom_service with improved error handling"""
    try:
        try:
            # First try the API call
            patient = await get_patient_details(patient_id, None)
            
            if patient:
                created_at = patient.get("created_at")
                if created_at:
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        
                    return PatientStatusEntry(
                        status="REGISTERED",
                        timestamp=created_at,
                        details={
                            "registration_number": patient.get("registration_number"),
                            "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}"
                        }
                    )
        except Exception as api_error:
            logger.warning(f"API fetch failed for patient {patient_id}: {str(api_error)}")
            
        # If the API call fails with 500 error, try to fetch from local database
        logger.info(f"Attempting to get patient {patient_id} from local database")
        pool = await get_app_pool()
        async with pool.acquire() as conn:
            try:
                # Try to find the patient in local database
                patient_query = """
                    SELECT * FROM patients WHERE id = $1 AND is_active = true
                """
                patient_record = await conn.fetchrow(patient_query, str(patient_id))
                
                if patient_record:
                    patient = dict(patient_record)
                    created_at = patient.get("created_at")
                    if created_at:
                        return PatientStatusEntry(
                            status="REGISTERED",
                            timestamp=created_at,
                            details={
                                "registration_number": patient.get("registration_number", "Unknown"),
                                "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}"
                            }
                        )
            except Exception as db_error:
                logger.warning(f"Database fetch failed for patient {patient_id}: {str(db_error)}")
        
        # If we reach here, both API and DB failed, create a fallback entry
        return PatientStatusEntry(
            status="REGISTERED",
            timestamp=datetime.now() - timedelta(days=7),  # Assume registered a week ago
            details={
                "registration_number": "Unknown",
                "patient_name": f"Patient {str(patient_id)[-8:]}",
                "note": "Registration details unavailable due to server error"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in get_patient_registration_event: {str(e)}")
        # Return a fallback entry even if everything fails
        return PatientStatusEntry(
            status="REGISTERED",
            timestamp=datetime.now() - timedelta(days=7),
            details={
                "registration_number": "Unknown",
                "patient_id": str(patient_id),
                "note": "Registration details unavailable due to error"
            }
        )

async def get_patient_opd_assignments(patient_id: UUID, doctor_id: UUID) -> List[PatientStatusEntry]:
    """Fetch patient OPD assignment events from cardroom_service"""
    events = []
    
    try:
        # Use existing http_client with retry logic
        url = f"{settings.CARDROOM_SERVICE_URL}/api/opd-assignments/patient/{patient_id}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            
            if response.status_code != 200:
                logger.error(f"Failed to fetch OPD assignments: {response.status_code} - {response.text}")
                return events
                
            assignments = response.json()
            
            for assignment in assignments:
                # Only include assignments to the current doctor
                if assignment.get("doctor_id") == str(doctor_id):
                    created_at = assignment.get("created_at")
                    if created_at:
                        if isinstance(created_at, str):
                            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                            
                        events.append(PatientStatusEntry(
                            status="ASSIGNED_OPD",
                            timestamp=created_at,
                            details={
                                "assignment_id": assignment.get("id"),
                                "doctor_name": assignment.get("doctor_name", "Unknown Doctor"),
                                "priority": assignment.get("priority", "NORMAL")
                            }
                        ))
        
        return events
    except Exception as e:
        logger.error(f"Error fetching OPD assignments: {str(e)}")
        return events
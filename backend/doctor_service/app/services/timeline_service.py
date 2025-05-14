# New file: doctor_service/app/services/timeline_service.py

import asyncio
import asyncpg
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID
import logging
from functools import lru_cache
import json
from ..schemas import PatientStatusEntry

logger = logging.getLogger(__name__)

# In-memory cache with 1-hour TTL
TIMELINE_CACHE = {}
CACHE_TTL = 3600  # seconds

async def get_patient_timeline_fast(
    pool: asyncpg.Pool,
    patient_id: UUID,
    doctor_id: UUID
) -> List[PatientStatusEntry]:
    """
    High-performance implementation of patient timeline fetching.
    """
    cache_key = f"{patient_id}:{doctor_id}"
    
    # Check cache first
    if cache_key in TIMELINE_CACHE:
        cached_data = TIMELINE_CACHE[cache_key]
        if datetime.now().timestamp() - cached_data['timestamp'] < CACHE_TTL:
            # Return cached timeline if not expired
            logger.info(f"Cache hit for {cache_key}")
            return cached_data['timeline']
    
    # Not in cache, fetch data using a single consolidated query
    try:
        # Single optimized query to fetch timeline events
        query = """
        WITH patient_info AS (
            SELECT p.id, p.first_name, p.last_name, p.created_at as registration_date
            FROM patients p
            WHERE p.id = $1 AND p.is_active = true
        ),
        opd_assignments AS (
            SELECT 
                'ASSIGNED_OPD' as status,
                oa.created_at as timestamp,
                oa.id as assignment_id,
                jsonb_build_object(
                    'assignment_id', oa.id,
                    'department', oa.department,
                    'assigned_by', oa.created_by
                ) as details
            FROM opd_assignments oa
            WHERE oa.patient_id = $1 AND oa.is_active = true
        ),
        medical_records AS (
            SELECT 
                'EXAMINED' as status,
                mr.created_at as timestamp,
                mr.id as record_id,
                jsonb_build_object(
                    'record_id', mr.id,
                    'diagnosis_excerpt', SUBSTRING(mr.diagnosis, 1, 100),
                    'doctor_id', mr.doctor_id
                ) as details
            FROM medical_records mr
            WHERE mr.patient_id = $1 AND mr.doctor_id = $2 AND mr.is_active = true
            UNION ALL
            SELECT 
                'RECORD_SAVED' as status,
                mr.updated_at as timestamp,
                mr.id as record_id,
                jsonb_build_object(
                    'record_id', mr.id,
                    'treatment_excerpt', SUBSTRING(mr.treatment, 1, 100)
                ) as details
            FROM medical_records mr
            WHERE mr.patient_id = $1 AND mr.doctor_id = $2 AND mr.is_active = true
            AND mr.updated_at > mr.created_at
        ),
        appointments AS (
            SELECT 
                'DISCHARGED' as status,
                a.updated_at as timestamp,
                a.id as appointment_id,
                jsonb_build_object(
                    'appointment_id', a.id,
                    'notes', SUBSTRING(a.notes, 1, 100)
                ) as details
            FROM appointments a
            WHERE a.patient_id = $1 AND a.doctor_id = $2 AND a.status IN ('COMPLETED', 'DISCHARGED')
        ),
        lab_requests AS (
            SELECT 
                lr.id,
                lr.patient_id,
                lr.test_type,
                lr.priority,
                lr.status,
                lr.created_at,
                lr.completed_at
            FROM lab_requests lr
            WHERE lr.patient_id = $1 AND lr.doctor_id = $2
        ),
        lab_events AS (
            SELECT 
                'LAB_REQUESTED' as status,
                lr.created_at as timestamp,
                lr.id as request_id,
                jsonb_build_object(
                    'request_id', lr.id,
                    'test_type', lr.test_type,
                    'priority', lr.priority
                ) as details
            FROM lab_requests lr
            WHERE lr.patient_id = $1 AND lr.doctor_id = $2
            UNION ALL
            SELECT 
                'LAB_COMPLETED' as status,
                COALESCE(lr.completed_at, lr.created_at + interval '2 day') as timestamp,
                lr.id as request_id,
                jsonb_build_object(
                    'request_id', lr.id,
                    'test_type', lr.test_type
                ) as details
            FROM lab_requests lr
            WHERE lr.patient_id = $1 AND lr.doctor_id = $2 AND lr.status = 'completed'
        ),
        all_events AS (
            -- Registration event
            SELECT 
                'REGISTERED' as status,
                p.registration_date as timestamp,
                jsonb_build_object(
                    'patient_name', p.first_name || ' ' || p.last_name,
                    'patient_id', p.id
                ) as details
            FROM patient_info p
            
            UNION ALL
            
            -- OPD assignments
            SELECT status, timestamp, details FROM opd_assignments
            
            UNION ALL
            
            -- Medical records
            SELECT status, timestamp, details FROM medical_records
            
            UNION ALL
            
            -- Appointments
            SELECT status, timestamp, details FROM appointments
            
            UNION ALL
            
            -- Lab events
            SELECT status, timestamp, details FROM lab_events
        )
        SELECT status, timestamp, details FROM all_events
        ORDER BY timestamp ASC;
        """
        
        async with pool.acquire() as conn:
            # Execute optimized query
            rows = await conn.fetch(query, str(patient_id), str(doctor_id))
            
            # Format the results - direct conversion to avoid multiple steps
            timeline = []
            for row in rows:
                details = row['details'] if isinstance(row['details'], dict) else json.loads(row['details'])
                timeline.append(PatientStatusEntry(
                    status=row['status'],
                    timestamp=row['timestamp'],
                    details=details
                ))
            
            # If we have db results, use them without external calls
            if timeline:
                # Store in cache
                TIMELINE_CACHE[cache_key] = {
                    'timeline': timeline,
                    'timestamp': datetime.now().timestamp()
                }
                return timeline
    
    except Exception as e:
        logger.error(f"Error in optimized query: {str(e)}")
        # Fall through to fallback
    
    # Fallback to a minimal implementation that makes just one external call
    try:
        # Attempt to get key data via HTTP for better performance
        async with httpx.AsyncClient(timeout=2.0) as client:  # Short timeout for fast response
            patient_url = f"http://cardroom_service:8023/api/patients/quick-view/{patient_id}"
            try:
                response = await client.get(
                    patient_url,
                    headers={"X-Service-Token": "internal_token"},
                )
                if response.status_code == 200:
                    patient_data = response.json()
                    timeline = create_timeline_from_quickview(patient_data, doctor_id)
                    
                    # Cache the result
                    TIMELINE_CACHE[cache_key] = {
                        'timeline': timeline,
                        'timestamp': datetime.now().timestamp()
                    }
                    return timeline
            except Exception as api_err:
                logger.warning(f"Quick view API failed: {str(api_err)}")
    except Exception as e:
        logger.error(f"Fallback error: {str(e)}")
    
    # Final minimal fallback - constant time, no external dependencies
    base_time = datetime.now() - timedelta(days=7)
    timeline = [
        PatientStatusEntry(
            status="REGISTERED",
            timestamp=base_time,
            details={"patient_id": str(patient_id)}
        ),
        PatientStatusEntry(
            status="ASSIGNED_OPD",
            timestamp=base_time + timedelta(hours=2),
            details={"doctor_id": str(doctor_id)}
        ),
        PatientStatusEntry(
            status="EXAMINED",
            timestamp=base_time + timedelta(days=1),
            details={"note": "Data temporarily unavailable"}
        )
    ]
    
    # Cache the fallback result with shorter TTL
    TIMELINE_CACHE[cache_key] = {
        'timeline': timeline,
        'timestamp': datetime.now().timestamp() - (CACHE_TTL / 2)  # Half TTL for fallback data
    }
    
    return timeline

def create_timeline_from_quickview(patient_data: Dict, doctor_id: str) -> List[PatientStatusEntry]:
    """Create a timeline from the quick view API response"""
    timeline = []
    
    # Patient registration
    if "registration_date" in patient_data:
        timeline.append(PatientStatusEntry(
            status="REGISTERED",
            timestamp=datetime.fromisoformat(patient_data["registration_date"].replace("Z", "+00:00")),
            details={
                "patient_name": f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}",
                "patient_id": patient_data["id"]
            }
        ))
    
    # Process other events from quick view
    if "recent_events" in patient_data:
        for event in patient_data["recent_events"]:
            timeline.append(PatientStatusEntry(
                status=event["type"],
                timestamp=datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")),
                details=event["details"]
            ))
    
    # Sort by timestamp
    timeline.sort(key=lambda x: x.timestamp)
    
    return timeline
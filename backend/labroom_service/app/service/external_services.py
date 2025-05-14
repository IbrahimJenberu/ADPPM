import aiohttp
import json
import httpx
import uuid
from typing import Dict, Any, Optional
import logging
from ..config import settings
from ..exceptions import ExternalServiceException
# Add missing import
from ..database import get_connection

logger = logging.getLogger(__name__)

async def fetch_patient_details(patient_id: uuid.UUID, token: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch patient details from the patient service.
    
    If token is not provided, a simplified approach will be used.
    """
    try:
        # Check if we need to use the actual API
        if settings.USE_EXTERNAL_SERVICES and token:
            patient_service_url = settings.PATIENT_SERVICE_URL
            endpoint = f"{patient_service_url}/api/patients/{patient_id}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to fetch patient details. Status: {response.status_code}, Response: {response.text}")
                    return {"error": "Failed to fetch patient details", "patient_id": str(patient_id)}
        
        # Simplified approach - fetch from local database if available
        conn = await get_connection()
        try:
            query = """
            SELECT * FROM patients WHERE id = $1
            """
            row = await conn.fetchrow(query, str(patient_id))
            
            if row:
                return dict(row)
            else:
                # Return basic info with just the ID
                return {"patient_id": str(patient_id), "info": "Basic patient info"}
        except Exception as e:
            logger.error(f"Error fetching patient from local DB: {str(e)}")
            return {"patient_id": str(patient_id), "info": "Basic patient info"}
        finally:
            await conn.close()
            
    except Exception as e:
        logger.error(f"Error fetching patient details: {str(e)}")
        return {"error": str(e), "patient_id": str(patient_id)}

async def fetch_doctor_details(doctor_id: uuid.UUID, token: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch doctor details from the doctor service.
    
    If token is not provided, a simplified approach will be used.
    """
    try:
        # Check if we need to use the actual API
        if settings.USE_EXTERNAL_SERVICES and token:
            doctor_service_url = settings.DOCTOR_SERVICE_URL
            endpoint = f"{doctor_service_url}/api/doctors/{doctor_id}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to fetch doctor details. Status: {response.status_code}, Response: {response.text}")
                    return {"error": "Failed to fetch doctor details", "doctor_id": str(doctor_id)}
        
        # Simplified approach - fetch from local database if available
        conn = await get_connection()
        try:
            query = """
            SELECT * FROM users WHERE id = $1 AND role = 'doctor'
            """
            row = await conn.fetchrow(query, str(doctor_id))
            
            if row:
                return dict(row)
            else:
                # Return basic info with just the ID
                return {"doctor_id": str(doctor_id), "info": "Basic doctor info"}
        except Exception as e:
            logger.error(f"Error fetching doctor from local DB: {str(e)}")
            return {"doctor_id": str(doctor_id), "info": "Basic doctor info"}
        finally:
            await conn.close()
            
    except Exception as e:
        logger.error(f"Error fetching doctor details: {str(e)}")
        return {"error": str(e), "doctor_id": str(doctor_id)}

async def send_notification_to_doctor(
    doctor_id: str, 
    notification_data: Dict[str, Any],
    token: str
) -> Dict[str, Any]:
    """Send notification to a doctor via doctor_service"""
    url = f"{settings.DOCTOR_SERVICE_URL}/notifications"
    
    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            async with session.post(
                url, 
                headers=headers, 
                data=json.dumps(notification_data)
            ) as response:
                if response.status not in (200, 201):
                    error_text = await response.text()
                    logger.error(f"Error sending notification to doctor: {error_text}")
                    raise ExternalServiceException("Doctor Service", f"Status {response.status}: {error_text}")
                
                return await response.json()
    except aiohttp.ClientError as e:
        logger.error(f"Connection error with doctor_service: {str(e)}")
        raise ExternalServiceException("Doctor Service", str(e))

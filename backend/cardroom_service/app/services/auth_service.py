# cardroom_service/app/services/auth_service.py
import httpx
from typing import Dict, Any, List, Optional
from uuid import UUID
import logging

from app.config import settings
from app.exceptions import ServiceUnavailableException

# cardroom_service/app/services/auth_service.py

async def get_doctor_from_auth(doctor_id: UUID) -> Optional[Dict[str, Any]]:
    """Fetch doctor information from the auth service (no authorization)."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://auth_service:8022/users/{doctor_id}",  # <-- No headers
                timeout=5.0
            )

            if response.status_code == 404:
                return None

            if response.status_code != 200:
                logging.error(f"Error from auth service: {response.text}")
                raise ServiceUnavailableException("Auth service error")

            return response.json()

    except httpx.RequestError as e:
        logging.error(f"Error connecting to auth service: {str(e)}")
        raise ServiceUnavailableException("Auth service unavailable")


async def get_doctors_from_auth() -> List[Dict[str, Any]]:
    """Fetch all doctors from the auth service."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://auth_service:8022/users/by-role/doctor",
                timeout=5.0
            )
            
            if response.status_code != 200:
                logging.error(f"Error from auth service: {response.text}")
                raise ServiceUnavailableException("Auth service error")
            
            return response.json()
            
    except httpx.RequestError as e:
        logging.error(f"Error connecting to auth service: {str(e)}")
        raise ServiceUnavailableException("Auth service unavailable")
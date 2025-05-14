# doctor_service/app/services/auth_service.py
import httpx
import logging
from fastapi import HTTPException, status
from typing import Dict, Any

logger = logging.getLogger(__name__)
 # Add token parameter
# doctor_service/app/services/auth_service.py
async def extract_doctor_from_auth_service(token: str) -> Dict[str, Any]:
    try:
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient() as client:
            response = await client.get("http://auth_service:8022/users/me", headers=headers)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Auth failed to get current doctor")
            user = response.json()
            if user.get("role") != "doctor":
                raise HTTPException(status_code=403, detail="Access restricted to doctors only")
            return user
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Auth service unavailable: {str(e)}")

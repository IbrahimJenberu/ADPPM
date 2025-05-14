from fastapi import APIRouter, Depends, HTTPException, Body
from app.security import create_access_token, verify_password
from app.service_credentials import SERVICE_CREDENTIALS

router = APIRouter(prefix="/service-auth", tags=["Service Authentication"])

@router.post("/token")
async def get_service_token(
    service_id: str = Body(...),
    service_secret: str = Body(...)
):
    """Generate a service-to-service authentication token."""

    # Validate service credentials
    if service_id not in SERVICE_CREDENTIALS:
        raise HTTPException(status_code=401, detail="Invalid service credentials")

    stored_hash = SERVICE_CREDENTIALS[service_id]
    if not verify_password(service_secret, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid service credentials")

    # Create token with service role
    token_data = {
        "sub": service_id,
        "role": "service",
        "service_name": service_id
    }

    access_token = create_access_token(data=token_data)
    return {"access_token": access_token, "token_type": "bearer"}

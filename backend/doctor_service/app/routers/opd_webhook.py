# doctor_service/app/routers/opd_webhook.py
import logging
import json
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Body, status
import uuid

from app.config import settings
from app.dependencies import get_db_pool
from app.routers.opd_ws import opd_manager, broadcast_patient_assignment
from app.services.cardroom_service import get_patient_details

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

async def verify_cardroom_token(
    authorization: str = Header(None, description="Authorization header")
):
    """Verify the service token from cardroom service"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )
        
    token_parts = authorization.split(' ')
    if len(token_parts) != 2 or token_parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )
        
    token = token_parts[1]
    
    if token != settings.SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token"
        )
    
    return token

@router.post("/opd-assignments", status_code=status.HTTP_200_OK)
async def receive_opd_assignment(
    data: Dict[str, Any] = Body(...),
    pool = Depends(get_db_pool)
):
    """
    Webhook endpoint for receiving OPD assignments from cardroom service.
    This provides a fallback for WebSocket failures.
    """
    try:
        doctor_id = data.get("doctor_id") or data.get("recipient_id")
        patient_id = data.get("patient_id") or data.get("entity_id")
        assignment_id = data.get("assignment_id") or data.get("entity_id") or data.get("id")
        
        if not doctor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: doctor_id or recipient_id"
            )
        
        logger.info(f"Received assignment webhook for doctor {doctor_id} and patient {patient_id}")
        
        # Extract assignment data - preserve complete patient details
        assignment_data = data.get("data", {})
        
        # For notifications that don't have assignment data in the "data" field
        if not assignment_data and "type" in data:
            assignment_data = data
            
        # If we don't have patient data but we have patient_id, try to get it
        if (
            patient_id and 
            (not assignment_data.get("patient") or not assignment_data.get("patient").get("id"))
        ):
            try:
                patient_details = await get_patient_details(uuid.UUID(str(patient_id)), pool)
                if patient_details:
                    # Add patient details to assignment data
                    if "patient" not in assignment_data:
                        assignment_data["patient"] = {}
                    
                    # Update with complete patient details
                    assignment_data["patient"].update({
                        "id": str(patient_details.get("id")),
                        "registration_number": patient_details.get("registration_number"),
                        "first_name": patient_details.get("first_name"),
                        "last_name": patient_details.get("last_name"),
                        "name": f"{patient_details.get('first_name', '')} {patient_details.get('last_name', '')}".strip(),
                        "date_of_birth": patient_details.get("date_of_birth"),
                        "gender": patient_details.get("gender"),
                        "blood_group": patient_details.get("blood_group"),
                        "phone_number": patient_details.get("phone_number"),
                        "email": patient_details.get("email"),
                        "address": patient_details.get("address"),
                        "allergies": patient_details.get("allergies", []),
                        "medical_history": patient_details.get("medical_history", {})
                    })
            except Exception as e:
                logger.warning(f"Failed to fetch patient details: {str(e)}")
        
        # Create WebSocket message
        message = {
            "event": "patient_assigned",
            "timestamp": datetime.now().isoformat(),
            "assignment_id": str(assignment_id) if assignment_id else None,
            "data": assignment_data  # Pass complete assignment data with patient details
        }
        
        # Try to broadcast to doctor
        delivered = False
        try:
            delivered = await opd_manager.broadcast_to_doctor(
                str(doctor_id), 
                message
            )
        except Exception as e:
            logger.error(f"Error broadcasting to doctor: {str(e)}")
        
        # Store the patient data locally if we received it
        try:
            if patient_id and assignment_data.get("patient"):
                patient_data = assignment_data.get("patient")
                # Upsert patient in local database for future access
                from app.models import Patient
                await Patient.upsert_patient(pool, patient_data)
                logger.info(f"Stored patient data locally for patient {patient_id}")
        except Exception as e:
            logger.warning(f"Failed to store patient data locally: {str(e)}")
        
        return {
            "success": True,
            "delivered": delivered,
            "doctor_id": str(doctor_id)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )
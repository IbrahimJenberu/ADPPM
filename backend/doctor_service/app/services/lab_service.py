# Updated version of doctor_service/app/services/lab_service.py

import httpx
from typing import List, Dict, Any, Optional
from uuid import UUID
import logging
from ..config import settings
from ..schemas import PatientStatusEntry
from datetime import datetime

logger = logging.getLogger(__name__)

# Enhanced version of get_patient_lab_events() function

async def get_patient_lab_events(
    patient_id: UUID,
    doctor_id: UUID
) -> List[PatientStatusEntry]:
    """
    Get lab request and result events from labroom_service for a patient.
    Enhanced to handle redirects and server errors.
    """
    lab_events = []
    
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:  # Add follow_redirects=True
            # Try multiple endpoint formats to find one that works
            endpoints = [
                f"{settings.LAB_SERVICE_URL}/api/lab-requests",
                f"{settings.LAB_SERVICE_URL}/lab-requests",  # Try without /api prefix
                f"{settings.LAB_SERVICE_URL}/api/inter-service/lab-requests"  # Try the inter-service endpoint
            ]
            
            lab_requests = []
            for endpoint in endpoints:
                try:
                    logger.info(f"Trying endpoint: {endpoint}")
                    response = await client.get(
                        endpoint,
                        params={
                            "doctor_id": str(doctor_id),
                            "patient_id": str(patient_id)
                        },
                        headers={"Authorization": f"Bearer {settings.SERVICE_TOKEN}"},
                        timeout=5.0  # Reduced timeout for faster fallback
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        # Handle different response formats
                        if "items" in data:
                            lab_requests = data["items"]
                        elif "lab_requests" in data:
                            lab_requests = data["lab_requests"]
                        else:
                            # Might be an array directly
                            lab_requests = data if isinstance(data, list) else []
                            
                        if lab_requests:
                            logger.info(f"Successfully fetched {len(lab_requests)} lab requests from {endpoint}")
                            break
                            
                except Exception as e:
                    logger.warning(f"Error with endpoint {endpoint}: {str(e)}")
                    continue
            
            # If we couldn't get lab requests for this specific patient
            # Let's try to get all requests for the doctor and filter
            if not lab_requests:
                logger.info("Attempting to get all doctor's lab requests")
                for endpoint in endpoints:
                    try:
                        fallback_response = await client.get(
                            endpoint,
                            params={"doctor_id": str(doctor_id)},
                            headers={"Authorization": f"Bearer {settings.SERVICE_TOKEN}"},
                            timeout=5.0
                        )
                        
                        if fallback_response.status_code == 200:
                            all_data = fallback_response.json()
                            
                            # Handle different response formats
                            all_requests = []
                            if "items" in all_data:
                                all_requests = all_data["items"]
                            elif "lab_requests" in all_data:
                                all_requests = all_data["lab_requests"]
                            else:
                                all_requests = all_data if isinstance(all_data, list) else []
                            
                            # Filter for the specific patient manually
                            lab_requests = [
                                req for req in all_requests 
                                if req.get("patient_id") == str(patient_id)
                            ]
                            
                            if lab_requests:
                                logger.info(f"Found {len(lab_requests)} lab requests for patient in doctor's history")
                                break
                    except Exception as e:
                        logger.warning(f"Error with fallback endpoint {endpoint}: {str(e)}")
                        continue
            
            # Process whatever lab requests we found
            for request in lab_requests:
                # Add LAB_REQUESTED event
                created_at = request.get("created_at")
                if created_at:
                    if isinstance(created_at, str):
                        try:
                            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        except ValueError:
                            try:
                                # Try another format
                                from dateutil import parser
                                created_at = parser.parse(created_at)
                            except:
                                # Default to current time if parsing fails
                                created_at = datetime.now()
                    
                    lab_events.append(PatientStatusEntry(
                        status="LAB_REQUESTED",
                        timestamp=created_at,
                        details={
                            "request_id": request["id"],
                            "test_type": request.get("test_type", "Unknown test"),
                            "priority": request.get("priority", request.get("urgency", "routine"))
                        }
                    ))
                
                # Check if this request has completed results
                if request.get("status") == "completed":
                    # For completed requests, try to get completion timestamp
                    completed_at = request.get("completed_at", created_at)
                    if isinstance(completed_at, str):
                        try:
                            completed_at = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                        except ValueError:
                            try:
                                # Try another format
                                from dateutil import parser
                                completed_at = parser.parse(completed_at)
                            except:
                                # Default to created_at or current time
                                completed_at = created_at or datetime.now()
                    
                    # Add LAB_COMPLETED event
                    lab_events.append(PatientStatusEntry(
                        status="LAB_COMPLETED",
                        timestamp=completed_at or datetime.now(),
                        details={
                            "request_id": request["id"],
                            "test_type": request.get("test_type", "Unknown test")
                        }
                    ))
            
            return lab_events
    except Exception as e:
        logger.error(f"Error fetching lab events: {str(e)}")
        return lab_events
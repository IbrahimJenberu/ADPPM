import uuid
import json
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from ..config import settings

logger = logging.getLogger(__name__)

async def notify_doctor_of_lab_result(
    lab_result_id: str,
    lab_request_id: str,
    doctor_id: str,
    test_type: str,
    conclusion: Optional[str] = None,
    result_data: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Send a notification to the doctor service about a completed lab result.
    
    This function makes an HTTP request to the doctor_service to deliver
    the lab result in real-time.
    """
    try:
        doctor_service_url = settings.DOCTOR_SERVICE_URL
        notification_endpoint = f"{doctor_service_url}/inter-service/lab-results"
        
        # Prepare notification data - include the FULL result_data
        notification_data = {
            "doctor_id": doctor_id,
            "lab_result_id": lab_result_id,
            "lab_request_id": lab_request_id,           
            "test_type": test_type,
            "conclusion": conclusion,
            "result_data": result_data,  # Include full result data, not just summary
            "created_at": datetime.now().isoformat()
        }
        
        # Still include the summary for backward compatibility
        result_summary = None
        if result_data:
            try:
                # Extract key metrics or summary data
                abnormal_values = []
                for k, v in result_data.items():
                    if isinstance(v, dict) and v.get("is_abnormal") is True:
                        abnormal_values.append({
                            "name": k,
                            "value": v.get("value"),
                            "unit": v.get("unit", ""),
                            "reference_range": v.get("reference_range", "")
                        })
                
                result_summary = {
                    "abnormal_values": abnormal_values,
                    "total_metrics": len(result_data),
                    "has_abnormal_values": len(abnormal_values) > 0
                }
                
                notification_data["result_summary"] = result_summary
            except Exception as e:
                logger.error(f"Error creating result summary: {str(e)}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                notification_endpoint,
                json=notification_data,
                headers={"Authorization": f"Bearer {settings.SERVICE_TOKEN}"},
                timeout=10.0
            )
            
            if response.status_code == 200:
                logger.info(f"Lab result notification sent to doctor {doctor_id}")
                return True
            else:
                logger.error(f"Failed to send lab result notification. Status: {response.status_code}, Response: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Error sending lab result notification: {str(e)}")
        return False
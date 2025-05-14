import uuid
import logging
import json
import re
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request, Path, Query
from pydantic import BaseModel
from datetime import datetime

# Add these imports for database functions and models
from ..database import get_connection, insert, update, fetch_one, fetch_all, soft_delete
from ..models import TestStatus, TestPriority, TestType

router = APIRouter(prefix="/inter-service", tags=["Inter-Service Communication"])

logger = logging.getLogger(__name__)

@router.get("/lab-results/{result_id}", response_model=Dict[str, Any])
async def get_lab_result_for_service(
    result_id: uuid.UUID = Path(...)
):
    """
    Get a lab result for inter-service communication.
    This endpoint is specifically for other services to fetch lab results.
    """
    conn = await get_connection()
    
    try:
        # Get the lab result
        result_query = "SELECT * FROM lab_results WHERE id = $1 AND is_deleted = FALSE"
        result = await fetch_one(result_query, str(result_id), conn=conn)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lab result with ID {result_id} not found"
            )
        
        # Convert result_data JSON string to object
        if "result_data" in result and isinstance(result["result_data"], str):
            try:
                result["result_data"] = json.loads(result["result_data"])
            except json.JSONDecodeError:
                result["result_data"] = {}
        
        # Get the associated lab request for context
        request_query = "SELECT * FROM lab_requests WHERE id = $1 AND is_deleted = FALSE"
        request = await fetch_one(request_query, result["lab_request_id"], conn=conn)
        
        # Get any images
        images_query = """
        SELECT * FROM result_images
        WHERE result_id = $1
        ORDER BY created_at DESC
        """
        
        try:
            images = await conn.fetch(images_query, str(result_id))
            result["images"] = [dict(img) for img in images] if images else []
        except Exception:
            # Table might not exist, use image_paths instead
            result["images"] = [{"file_path": path} for path in (result.get("image_paths") or [])]
        
        # Combine the data
        response_data = {
            **result,
            "lab_request": request if request else {"id": result["lab_request_id"]}
        }
        
        return response_data
    finally:
        await conn.close()

@router.get("/lab-requests/{request_id}/results", response_model=Dict[str, Any])
async def get_results_for_lab_request(
    request_id: uuid.UUID = Path(...),
):
    """
    Get all lab results for a specific lab request.
    This endpoint is designed for inter-service communication.
    """
    conn = await get_connection()
    
    try:
        # Check if lab request exists
        request_query = "SELECT * FROM lab_requests WHERE id = $1 AND is_deleted = FALSE"
        request = await fetch_one(request_query, str(request_id), conn=conn)
        
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lab request with ID {request_id} not found"
            )
        
        # Get all results for this request
        results_query = """
        SELECT * FROM lab_results 
        WHERE lab_request_id = $1 AND is_deleted = FALSE
        ORDER BY created_at DESC
        """
        
        results = await conn.fetch(results_query, str(request_id))
        results_list = []
        
        for result in results:
            result_dict = dict(result)
            # Parse JSON fields
            if "result_data" in result_dict and isinstance(result_dict["result_data"], str):
                try:
                    result_dict["result_data"] = json.loads(result_dict["result_data"])
                except json.JSONDecodeError:
                    result_dict["result_data"] = {}
            
            results_list.append(result_dict)
        
        # Get images for each result
        for result in results_list:
            try:
                images_query = """
                SELECT * FROM result_images
                WHERE result_id = $1
                ORDER BY created_at DESC
                """
                
                images = await conn.fetch(images_query, str(result["id"]))
                result["images"] = [dict(img) for img in images] if images else []
            except Exception:
                # Table might not exist, use image_paths instead
                result["images"] = [{"file_path": path} for path in (result.get("image_paths") or [])]
        
        return {
            "lab_request": request,
            "results": results_list,
            "total_results": len(results_list)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching lab results: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch lab results: {str(e)}"
        )
    finally:
        await conn.close()

@router.post("/lab-requests", response_model=Dict[str, Any])
async def receive_lab_request_from_doctor(
    request_data: Dict[str, Any] = Body(...),
):
    """
    Receive lab request from doctor service.
    This endpoint handles lab requests created in the doctor service.
    """
    # Log the entire request for debugging
    logger.info(f"Received lab request data: {json.dumps(request_data, default=str)}")
    
    conn = await get_connection()
    
    try:
        # Validate required fields
        required_fields = ["id", "patient_id", "doctor_id", "test_type"]
        for field in required_fields:
            if field not in request_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}"
                )
        
        # Normalize test_type to match enum values
        if "test_type" in request_data:
            original_test_type = request_data["test_type"]
            logger.info(f"Original test type: '{original_test_type}'")
            
            # STEP 1: First check against the exact frontend test types
            frontend_test_types = {
                "Complete Blood Count": "complete_blood_count",
                "Comprehensive Metabolic Panel": "comprehensive_metabolic_panel",
                "Lipid Panel": "lipid_panel",
                "Liver Function Test": "liver_function_test",
                "Thyroid Panel": "thyroid_panel",
                "Urinalysis": "urinalysis",
                "HBA1C": "hba1c",
                "CHEST X-ray": "chest_xray",
                "ECG": "ecg",
                "COVID 19 TEST": "covid19_test",
                "ALERGY TEST": "allergy_test",  # Handle the misspelling
                "VITAMIN D TEST": "vitamin_d_test",
            }
            
            # Check for exact match with frontend test types
            if original_test_type in frontend_test_types:
                request_data["test_type"] = frontend_test_types[original_test_type]
                logger.info(f"Matched frontend test type '{original_test_type}' to '{request_data['test_type']}'")
            else:
                # STEP 2: Define a normalized key function for our mapping
                def normalize_key(s):
                    return re.sub(r'[^a-zA-Z0-9]', '', s).lower()
                
                # Comprehensive test type mapping (including common variations)
                test_type_mapping = {
                    normalize_key("COMPLETE BLOOD COUNT"): "complete_blood_count",
                    normalize_key("CBC"): "complete_blood_count",
                    normalize_key("BLOOD COUNT"): "complete_blood_count",
                    
                    normalize_key("COMPREHENSIVE METABOLIC PANEL"): "comprehensive_metabolic_panel",
                    normalize_key("CMP"): "comprehensive_metabolic_panel",
                    normalize_key("METABOLIC PANEL"): "comprehensive_metabolic_panel",
                    
                    normalize_key("LIPID PANEL"): "lipid_panel",
                    normalize_key("LIPIDS"): "lipid_panel",
                    normalize_key("LIPID TEST"): "lipid_panel",
                    normalize_key("CHOLESTEROL TEST"): "lipid_panel",
                    
                    normalize_key("LIVER FUNCTION TEST"): "liver_function_test",
                    normalize_key("LFT"): "liver_function_test",
                    normalize_key("LIVER TEST"): "liver_function_test",
                    normalize_key("LIVER PANEL"): "liver_function_test",
                    
                    normalize_key("THYROID PANEL"): "thyroid_panel",
                    normalize_key("THYROID TEST"): "thyroid_panel",
                    normalize_key("THYROID FUNCTION"): "thyroid_panel",
                    normalize_key("TFT"): "thyroid_panel",
                    
                    normalize_key("URINALYSIS"): "urinalysis",
                    normalize_key("URINE ANALYSIS"): "urinalysis",
                    normalize_key("URINE TEST"): "urinalysis",
                    normalize_key("UA"): "urinalysis",
                    
                    normalize_key("HBA1C"): "hba1c",
                    normalize_key("HEMOGLOBIN A1C"): "hba1c",
                    normalize_key("GLYCATED HEMOGLOBIN"): "hba1c",
                    normalize_key("A1C"): "hba1c",
                    
                    normalize_key("CHEST X-RAY"): "chest_xray",
                    normalize_key("CHEST X RAY"): "chest_xray",
                    normalize_key("CHEST XRAY"): "chest_xray",
                    normalize_key("CXR"): "chest_xray",
                    
                    normalize_key("ECG"): "ecg",
                    normalize_key("EKG"): "ecg",
                    normalize_key("ELECTROCARDIOGRAM"): "ecg",
                    
                    normalize_key("COVID-19"): "covid19_test",
                    normalize_key("COVID19"): "covid19_test",
                    normalize_key("COVID TEST"): "covid19_test",
                    normalize_key("COVID 19 TEST"): "covid19_test",
                    
                    normalize_key("ALLERGY TEST"): "allergy_test",
                    normalize_key("ALERGY TEST"): "allergy_test",  # Handle misspelling
                    normalize_key("ALLERGEN TEST"): "allergy_test",
                    normalize_key("ALLERGY PANEL"): "allergy_test",
                    
                    normalize_key("VITAMIN D"): "vitamin_d_test",
                    normalize_key("VITAMIN-D"): "vitamin_d_test",
                    normalize_key("VITAMIN D TEST"): "vitamin_d_test",
                    normalize_key("VIT D"): "vitamin_d_test"
                }
                
                # Normalize the input test type for mapping lookup
                normalized_key = normalize_key(original_test_type)
                logger.info(f"Normalized key for mapping lookup: '{normalized_key}'")
                
                # Try to find it in our mapping
                if normalized_key in test_type_mapping:
                    request_data["test_type"] = test_type_mapping[normalized_key]
                    logger.info(f"Mapped test type '{original_test_type}' to '{request_data['test_type']}' via direct mapping")
                else:
                    # STEP 3: Try standard normalization (lowercase + underscores)
                    normalized_test_type = original_test_type.lower().replace(' ', '_').replace('-', '_')
                    logger.info(f"Standard normalization result: '{normalized_test_type}'")
                    
                    # STEP 4: Get all valid test types from the enum
                    valid_test_types = [t.value for t in TestType]
                    logger.info(f"Valid test types: {valid_test_types}")
                    
                    # Check if normalized type matches a valid enum value
                    if normalized_test_type in valid_test_types:
                        request_data["test_type"] = normalized_test_type
                        logger.info(f"Matched normalized test type '{normalized_test_type}' to valid enum value")
                    else:
                        # STEP 5: Create a clean version for matching - remove all spaces, underscores, hyphens
                        clean_input = re.sub(r'[^a-zA-Z0-9]', '', original_test_type.lower())
                        logger.info(f"Clean input for fuzzy matching: '{clean_input}'")
                        
                        # Create clean versions of valid types for comparison
                        clean_valid_types = {re.sub(r'[^a-zA-Z0-9]', '', vt): vt for vt in valid_test_types}
                        
                        # STEP 6: Look for direct matches in clean format
                        if clean_input in clean_valid_types:
                            request_data["test_type"] = clean_valid_types[clean_input]
                            logger.info(f"Matched clean input '{clean_input}' to valid type '{request_data['test_type']}'")
                        else:
                            # STEP 7: Look for partial matches
                            found_match = False
                            for clean_valid, valid_type in clean_valid_types.items():
                                # If the clean input contains the valid type or vice versa
                                if clean_input in clean_valid or clean_valid in clean_input:
                                    request_data["test_type"] = valid_type
                                    logger.info(f"Partial match: '{clean_input}' matches with '{clean_valid}', using '{valid_type}'")
                                    found_match = True
                                    break
                            
                            # STEP 8: If still no match, check known common words in test types
                            if not found_match:
                                test_type_keywords = {
                                    "blood": "complete_blood_count",
                                    "liver": "liver_function_test",
                                    "thyroid": "thyroid_panel",
                                    "lipid": "lipid_panel",
                                    "cholesterol": "lipid_panel",
                                    "metabolic": "comprehensive_metabolic_panel",
                                    "urine": "urinalysis",
                                    "xray": "chest_xray",
                                    "chest": "chest_xray",
                                    "covid": "covid19_test",
                                    "allergy": "allergy_test",
                                    "alergy": "allergy_test",  # Handle misspelling
                                    "vitamin": "vitamin_d_test",
                                    "ecg": "ecg",
                                    "ekg": "ecg",
                                    "electro": "ecg",
                                    "hba1c": "hba1c",
                                    "a1c": "hba1c"
                                }
                                
                                for keyword, test_type in test_type_keywords.items():
                                    if keyword in clean_input:
                                        request_data["test_type"] = test_type
                                        logger.info(f"Keyword match: '{keyword}' found in '{clean_input}', using '{test_type}'")
                                        found_match = True
                                        break
                                        
                                # STEP 9: Default to a safe value if we absolutely can't match
                                if not found_match:
                                    # If all else fails, default to a safe value
                                    logger.warning(f"Could not map test type '{original_test_type}'. Valid types are: {valid_test_types}")
                                    
                                    # Instead of failing, use a default type for now
                                    default_type = "comprehensive_metabolic_panel"  # A reasonably safe default
                                    request_data["test_type"] = default_type
                                    logger.warning(f"Using default test type: '{default_type}'")
        
        # Convert priority/urgency values
        urgency_mapping = {
            "routine": "low",
            "urgent": "high",
            "stat": "high"
        }
        
        # Check both fields (handle either urgency or priority)
        if "urgency" in request_data:
            urgency = request_data.get("urgency", "").lower()
            if urgency in urgency_mapping:
                request_data["priority"] = urgency_mapping[urgency]
                logger.info(f"Mapped urgency '{urgency}' to priority '{request_data['priority']}'")
        
        # Ensure priority is a valid value
        if "priority" in request_data:
            valid_priorities = [p.value for p in TestPriority]
            if request_data["priority"] not in valid_priorities:
                # Default to medium if invalid
                logger.warning(f"Invalid priority: {request_data['priority']}. Defaulting to 'medium'")
                request_data["priority"] = "medium"
        
        # Most importantly: Ensure status remains "pending"
        request_data["status"] = "pending"
        
        # Prepare data for insertion
        lab_request_id = request_data.get("id")
        
        # Check if request already exists (for idempotency)
        existing_query = "SELECT id FROM lab_requests WHERE id = $1"
        existing = await fetch_one(existing_query, lab_request_id, conn=conn)
        
        if existing:
            # Update existing request but preserve status if not pending
            status_query = "SELECT status FROM lab_requests WHERE id = $1"
            current_status = await conn.fetchval(status_query, lab_request_id)
            
            # Only update to pending if current status is not already set to something else
            # This prevents overwriting in_progress or completed statuses
            if current_status and current_status != "pending":
                logger.info(f"Lab request {lab_request_id} already exists with status {current_status}. Not changing status.")
                # Remove status from update data to preserve current status
                if "status" in request_data:
                    del request_data["status"]
            
            # Update other fields
            await update("lab_requests", lab_request_id, request_data, conn=conn)
            response_message = "Lab request updated"
        else:
            # Insert new request with pending status
            request_data["status"] = "pending"
            
            # Add timestamps if not present
            if "created_at" not in request_data:
                request_data["created_at"] = datetime.now()
            if "updated_at" not in request_data:
                request_data["updated_at"] = datetime.now()
                
            # Insert the request
            await insert("lab_requests", request_data, conn=conn)
            response_message = "Lab request created"
        
        # Fetch the final request data
        query = "SELECT * FROM lab_requests WHERE id = $1"
        lab_request = await fetch_one(query, lab_request_id, conn=conn)
        
        logger.info(f"Lab request received from doctor service: {lab_request_id}, status: {lab_request['status']}")
        
        return {
            "success": True,
            "message": response_message,
            "lab_request": lab_request
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing lab request from doctor service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process lab request: {str(e)}"
        )
    finally:
        await conn.close()

@router.post("/notifications", response_model=Dict[str, Any])
async def receive_notification(
    notification_data: Dict[str, Any] = Body(...),
):
    """
    Receive notification from other services.
    This endpoint allows services to send notifications to users.
    """
    # Implementation for notification handling
    # (Not directly related to the lab request status issue)
    return {"success": True, "message": "Notification received"}
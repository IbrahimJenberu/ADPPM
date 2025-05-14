# doctor_service/app/routers/ai_diagnosis.py
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Path, Query, Body
import logging

from app import schemas
from app.dependencies import get_db_pool, get_current_doctor, validate_doctor_patient_access
from app.exceptions import PatientNotFoundException, AIModelException, DatabaseException
from app.ai.xray_analyzer import chest_xray_analyzer
from app.ai.mri_analyzer import brain_mri_analyzer
from app.ai.symptom_analyzer import symptom_analyzer

# Attempt to import NotFittedError, provide fallback if sklearn is unavailable
try:
    from sklearn.exceptions import NotFittedError
except ImportError:
    class NotFittedError(Exception):
        """Fallback exception when sklearn is not installed."""
        pass

# Import the ML pipeline dependency
try:
    from app.ai.ml_pipeline import ClinicalDiseasePipeline
    from app.ai.model_loader import get_pipeline
    AI_ENABLED = True
except ImportError as e:
    startup_logger = logging.getLogger("ClinicalAI_API")
    startup_logger.critical(f"Failed to import AI components: {e}", exc_info=True)
    AI_ENABLED = False

# Router setup
logger = logging.getLogger("ClinicalAI_API")
router = APIRouter(prefix="/ai-diagnosis", tags=["ai diagnosis"])

if AI_ENABLED:
    @router.post(
        "/symptoms",
        response_model=schemas.SymptomAIAnalysisResponse,
        summary="Analyze Symptoms for Disease Prediction",
        description="Receives patient symptoms and clinical data, returns potential disease diagnosis, severity, probability, and validation checks."
    )
    async def analyze_symptoms_pipeline(
        symptom_data: schemas.SymptomInputData = Body(...),
        model: ClinicalDiseasePipeline = Depends(get_pipeline),
    ):
        logger.info("Received symptom analysis request.")
        try:
            # Convert Pydantic model to dict
            data = getattr(symptom_data, 'model_dump', symptom_data.dict)(exclude_unset=True)
            logger.info(f"Input features: {list(data.keys())}")

            # Prediction
            prediction = model.predict_single(data, explain=False)
            logger.info("Prediction completed.")

            result = schemas.SymptomPredictionResult(
                disease=prediction.get("disease", ""),
                probability=prediction.get("probability", 0.0),
                severity=prediction.get("severity", ""),
                severity_score=prediction.get("severity_score"),
                validation=prediction.get("validation", {}),
                explanation=prediction.get("explanation", {})
            )

            return schemas.SymptomAIAnalysisResponse(
                success=True,
                message="Symptom analysis completed successfully.",
                result=result
            )

        except NotFittedError:
            logger.error("Model not fitted", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI model is not ready for predictions."
            )
        except ValueError as ve:
            logger.error(f"Invalid input: {ve}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(ve)
            )
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during symptom analysis."
            )
else:
    logger.warning("Symptom analysis endpoint disabled; AI components unavailable.")

@router.post("/chest-xray", response_model=schemas.AIAnalysisResponse)
async def analyze_chest_xray(
    analysis_request: schemas.ChestXrayAnalysisRequest,
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID")
):
    try:
        result = chest_xray_analyzer.analyze(analysis_request.image_data)
        return {"success": True, "message": "Chest X-ray analysis completed.", "result": result}
    except Exception as e:
        raise AIModelException(detail=f"Failed to analyze chest X-ray: {e}")

@router.post("/brain-mri", response_model=schemas.AIAnalysisResponse)
async def analyze_brain_mri(
    analysis_request: schemas.BrainMRIAnalysisRequest,
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID")
):
    try:
        result = brain_mri_analyzer.analyze(analysis_request.image_data)
        return {"success": True, "message": "Brain MRI analysis completed.", "result": result}
    except Exception as e:
        raise AIModelException(detail=f"Failed to analyze brain MRI: {e}")

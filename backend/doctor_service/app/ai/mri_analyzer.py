# doctor_service/app/ai/mri_analayzer.py
import base64
import io
import numpy as np
from PIL import Image
import json
from typing import Dict, List, Any
import os
from pathlib import Path

from app.config import settings

# Define disease classes for brain MRI
BRAIN_MRI_CLASSES = [
    "Normal",
    "Glioma",
    "Meningioma",
    "Pituitary Tumor",
    "Ischemic Stroke",
    "Hemorrhagic Stroke",
    "Multiple Sclerosis",
    "Alzheimer's Disease",
    "Hydrocephalus",
    "Traumatic Brain Injury"
]

class BrainMRIAnalyzer:
    """AI model for brain MRI analysis using DEBNSNet"""
    
    def __init__(self):
        # In a real system, we would load the actual model here
        # For this example, we'll simulate the model
        model_path = settings.BRAIN_MRI_MODEL_PATH
        
        # For the example, we'll simulate the model
        self.model_path = model_path
        self.initialized = True
        
    def preprocess_image(self, image_data: str) -> np.ndarray:
        """Preprocess the base64 encoded image for the model."""
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            
            # Resize to model input size
            image = image.resize((224, 224))
            
            # Convert to numpy array and normalize
            img_array = np.array(image).astype(np.float32) / 255.0
            
            # Add batch dimension and convert to NCHW format for ONNX
            img_array = np.transpose(img_array, (2, 0, 1))
            img_array = np.expand_dims(img_array, axis=0)
            
            return img_array
            
        except Exception as e:
            raise ValueError(f"Failed to preprocess image: {str(e)}")
    
    def analyze(self, image_data: str) -> Dict[str, Any]:
        """Analyze a brain MRI image and return predictions."""
        try:
            # In a real system, you would do actual inference here
            # For this example, we'll simulate predictions
            # Generate random predictions for demonstration
            predictions = np.random.random(len(BRAIN_MRI_CLASSES))
            predictions = predictions / np.sum(predictions)  # Normalize to sum to 1
            
            # Get top 3 predictions
            top_indices = predictions.argsort()[-3:][::-1]
            top_predictions = [
                {"condition": BRAIN_MRI_CLASSES[i], "probability": float(predictions[i])}
                for i in top_indices
            ]
            
            # Generate a recommendation based on top prediction
            top_condition = BRAIN_MRI_CLASSES[top_indices[0]]
            recommendation = self._generate_recommendation(top_condition)
            
            return {
                "prediction": top_condition,
                "confidence": float(predictions[top_indices[0]]),
                "possible_conditions": top_predictions,
                "recommendation": recommendation
            }
            
        except Exception as e:
            raise ValueError(f"Failed to analyze brain MRI: {str(e)}")
    
    def _generate_recommendation(self, condition: str) -> str:
        """Generate a recommendation based on the predicted condition."""
        recommendations = {
            "Normal": "No significant abnormalities detected. Recommend clinical correlation.",
            "Glioma": "Findings consistent with glioma. Recommend neurosurgery consultation and possible biopsy.",
            "Meningioma": "Findings consistent with meningioma. Recommend neurosurgery consultation for evaluation.",
            "Pituitary Tumor": "Findings suggest pituitary tumor. Recommend endocrinology and neurosurgery consultation.",
            "Ischemic Stroke": "Findings consistent with ischemic stroke. Recommend immediate neurological evaluation.",
            "Hemorrhagic Stroke": "Findings consistent with hemorrhagic stroke. Recommend immediate neurosurgical consultation.",
            "Multiple Sclerosis": "Findings suggest multiple sclerosis. Recommend neurology consultation and CSF analysis.",
            "Alzheimer's Disease": "Findings consistent with Alzheimer's disease. Recommend neurology consultation.",
            "Hydrocephalus": "Findings consistent with hydrocephalus. Recommend neurosurgical evaluation.",
            "Traumatic Brain Injury": "Findings consistent with traumatic brain injury. Recommend neurosurgical evaluation and close monitoring."
        }
        
        return recommendations.get(condition, "Recommend clinical correlation and specialist consultation as appropriate.")

# Create a singleton instance
brain_mri_analyzer = BrainMRIAnalyzer()
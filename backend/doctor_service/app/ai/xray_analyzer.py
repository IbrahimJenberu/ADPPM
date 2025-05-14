# doctor_service/app/ai/xray_analayzer.py
import base64
import io
import numpy as np
from PIL import Image
import onnxruntime
import json
from typing import Dict, List, Any
import os
from pathlib import Path

from app.config import settings

# Define disease classes for chest X-ray
CHEST_XRAY_CLASSES = [
    "Normal",
    "Pneumonia",
    "Tuberculosis",
    "COVID-19",
    "Lung Cancer",
    "Pleural Effusion",
    "Pneumothorax",
    "Pulmonary Edema",
    "Emphysema",
    "Fibrosis"
]

class ChestXrayAnalyzer:
    """AI model for chest X-ray analysis using DEBNSNet"""
    
    def __init__(self):
        # In a real system, we would load the actual model here
        # For this example, we'll simulate the model
        model_path = settings.CHEST_XRAY_MODEL_PATH
        
        # If using actual model, you would load it like this:
        # if os.path.exists(model_path):
        #     self.session = onnxruntime.InferenceSession(model_path)
        # else:
        #     raise FileNotFoundError(f"Model file not found: {model_path}")
        
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
        """Analyze a chest X-ray image and return predictions."""
        try:
            # In a real system, you would do actual inference here
            # preprocessed_image = self.preprocess_image(image_data)
            # input_name = self.session.get_inputs()[0].name
            # output = self.session.run(None, {input_name: preprocessed_image})
            # predictions = output[0][0]
            
            # For this example, we'll simulate predictions
            # Generate random predictions for demonstration
            predictions = np.random.random(len(CHEST_XRAY_CLASSES))
            predictions = predictions / np.sum(predictions)  # Normalize to sum to 1
            
            # Get top 3 predictions
            top_indices = predictions.argsort()[-3:][::-1]
            top_predictions = [
                {"condition": CHEST_XRAY_CLASSES[i], "probability": float(predictions[i])}
                for i in top_indices
            ]
            
            # Generate a recommendation based on top prediction
            top_condition = CHEST_XRAY_CLASSES[top_indices[0]]
            recommendation = self._generate_recommendation(top_condition)
            
            return {
                "prediction": top_condition,
                "confidence": float(predictions[top_indices[0]]),
                "possible_conditions": top_predictions,
                "recommendation": recommendation
            }
            
        except Exception as e:
            raise ValueError(f"Failed to analyze chest X-ray: {str(e)}")
    
    def _generate_recommendation(self, condition: str) -> str:
        """Generate a recommendation based on the predicted condition."""
        recommendations = {
            "Normal": "No significant findings. Recommend routine follow-up if symptoms persist.",
            "Pneumonia": "Findings suggest pneumonia. Recommend antibiotic therapy and follow-up imaging in 2 weeks.",
            "Tuberculosis": "Findings suggest possible tuberculosis. Recommend sputum analysis and isolation precautions.",
            "COVID-19": "Findings consistent with COVID-19 pneumonia. Recommend PCR testing and isolation.",
            "Lung Cancer": "Suspicious for malignancy. Recommend CT scan and pulmonology consultation.",
            "Pleural Effusion": "Pleural effusion detected. Recommend thoracentesis if clinically indicated.",
            "Pneumothorax": "Pneumothorax detected. Recommend immediate intervention based on size and symptoms.",
            "Pulmonary Edema": "Findings consistent with pulmonary edema. Recommend cardiac evaluation.",
            "Emphysema": "Findings suggest emphysema. Recommend pulmonary function tests and smoking cessation.",
            "Fibrosis": "Findings suggest pulmonary fibrosis. Recommend high-resolution CT and pulmonology consultation."
        }
        
        return recommendations.get(condition, "Recommend clinical correlation and follow-up as appropriate.")

# Create a singleton instance
chest_xray_analyzer = ChestXrayAnalyzer()
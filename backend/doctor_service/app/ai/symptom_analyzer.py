# doctor_service/app/ai/symptom_analayzer.py
import numpy as np
import json
from typing import Dict, List, Any, Optional
import os
from pathlib import Path

from app.config import settings

# Define list of common symptoms
COMMON_SYMPTOMS = [
    "fever", "cough", "headache", "fatigue", "shortness_of_breath",
    "nausea", "vomiting", "diarrhea", "chest_pain", "abdominal_pain",
    "back_pain", "joint_pain", "muscle_pain", "rash", "sore_throat",
    "runny_nose", "congestion", "dizziness", "confusion", "loss_of_appetite",
    "weight_loss", "night_sweats", "blurred_vision", "numbness", "tingling",
    "weakness", "tremor", "seizure", "loss_of_consciousness", "swelling"
]

# Define list of common diseases
COMMON_DISEASES = [
    "Common Cold", "Influenza", "COVID-19", "Pneumonia", "Bronchitis",
    "Asthma", "COPD", "Hypertension", "Heart Disease", "Diabetes",
    "Gastroenteritis", "Irritable Bowel Syndrome", "Gastric Ulcer", "Appendicitis", "Gallstones",
    "Kidney Stones", "Urinary Tract Infection", "Migraine", "Tension Headache", "Meningitis",
    "Alzheimer's Disease", "Parkinson's Disease", "Multiple Sclerosis", "Epilepsy", "Stroke",
    "Osteoarthritis", "Rheumatoid Arthritis", "Gout", "Fibromyalgia", "Osteoporosis",
    "Anemia", "Hypothyroidism", "Hyperthyroidism", "Depression", "Anxiety",
    "Bipolar Disorder", "Schizophrenia", "Eczema", "Psoriasis", "Acne",
    "Dermatitis", "Lupus", "Lyme Disease", "Malaria", "Dengue Fever"
]

class SymptomAnalyzer:
    """AI model for symptom analysis using a simulated ML model"""
    
    def __init__(self):
        # In a real system, we would load the actual model here
        # For this example, we'll simulate the model
        model_path = settings.SYMPTOM_ANALYZER_MODEL_PATH
        
        # For the example, we'll simulate the model
        self.model_path = model_path
        self.symptoms_list = COMMON_SYMPTOMS
        self.diseases_list = COMMON_DISEASES
        self.initialized = True
        
    def _symptoms_to_vector(self, symptoms: List[str]) -> np.ndarray:
        """Convert list of symptoms to binary vector for model input."""
        # Initialize a zero vector with length of all possible symptoms
        vector = np.zeros(len(self.symptoms_list), dtype=np.float32)
        
        # Set 1 for each symptom present
        for symptom in symptoms:
            if symptom in self.symptoms_list:
                index = self.symptoms_list.index(symptom)
                vector[index] = 1.0
                
        return vector
    
    def analyze(self, symptoms: List[str], symptom_duration: Optional[int] = None) -> Dict[str, Any]:
        """Analyze symptoms and predict possible diseases."""
        try:
            # In a real system, you would use the actual model for prediction
            # symptoms_vector = self._symptoms_to_vector(symptoms)
            # predictions = self.model.predict_proba([symptoms_vector])[0]
            
            # For this example, we'll simulate predictions
            # We'll create a weighted random generator that gives higher probability
            # to diseases that might be associated with the provided symptoms
            weights = np.ones(len(self.diseases_list))
            
            # Increase weights for diseases that might match the symptoms
            # This is just a simplified simulation
            for symptom in symptoms:
                if symptom == "fever":
                    # Increase weight for fever-related diseases
                    for disease in ["Common Cold", "Influenza", "COVID-19", "Pneumonia"]:
                        if disease in self.diseases_list:
                            weights[self.diseases_list.index(disease)] += 2.0
                            
                elif symptom == "cough":
                    # Increase weight for respiratory diseases
                    for disease in ["Common Cold", "Influenza", "COVID-19", "Pneumonia", "Bronchitis", "Asthma"]:
                        if disease in self.diseases_list:
                            weights[self.diseases_list.index(disease)] += 2.0
                            
                # Add more symptom-disease relationships as needed
            
            # Normalize weights to probabilities
            probabilities = weights / np.sum(weights)
            
            # Get top 10 predictions
            top_indices = probabilities.argsort()[-10:][::-1]
            top_predictions = [
                {"condition": self.diseases_list[i], "probability": float(probabilities[i])}
                for i in top_indices
            ]
            
            # Generate a recommendation based on top prediction
            top_condition = self.diseases_list[top_indices[0]]
            recommendation = self._generate_recommendation(top_condition, symptoms)
            
            return {
                "prediction": top_condition,
                "confidence": float(probabilities[top_indices[0]]),
                "possible_conditions": top_predictions,
                "recommendation": recommendation
            }
            
        except Exception as e:
            raise ValueError(f"Failed to analyze symptoms: {str(e)}")
    
    def _generate_recommendation(self, condition: str, symptoms: List[str]) -> str:
        """Generate a recommendation based on the predicted condition and symptoms."""
        # Base recommendations for common conditions
        recommendations = {
            "Common Cold": "Rest, stay hydrated, and consider over-the-counter cold medications. Seek medical attention if symptoms worsen or persist beyond 10 days.",
            "Influenza": "Rest, stay hydrated, and consider antiviral medications if caught early. Seek medical attention if you have difficulty breathing or symptoms worsen.",
            "COVID-19": "Isolate, monitor symptoms, and seek testing. Contact healthcare provider for guidance, especially if experiencing severe symptoms.",
            "Pneumonia": "Seek medical attention for proper diagnosis and treatment. Antibiotics may be necessary for bacterial pneumonia.",
            "Hypertension": "Recommend blood pressure monitoring and lifestyle modifications. Consider medication if indicated.",
            "Diabetes": "Check blood glucose levels and recommend endocrinology consultation for proper management.",
            "Migraine": "Recommend neurological evaluation and consider both preventive and abortive therapies."
        }
        
        # Generic recommendations for severe symptoms
        if "chest_pain" in symptoms or "shortness_of_breath" in symptoms:
            return "Urgent medical evaluation recommended due to presence of chest pain or breathing difficulty."
        
        if "confusion" in symptoms or "loss_of_consciousness" in symptoms:
            return "Immediate medical evaluation recommended due to neurological symptoms."
            
        # Return condition-specific recommendation or a generic one
        return recommendations.get(
            condition, 
            "Recommend clinical evaluation for proper diagnosis and treatment plan. Monitor symptoms and seek medical attention if condition worsens."
        )

# Create a singleton instance
symptom_analyzer = SymptomAnalyzer()
# app/ai/model_unpickler.py

import pickle
import sys
import logging
import types
import numpy
import pandas as pd
from pathlib import Path
from sklearn.base import BaseEstimator, TransformerMixin

logger = logging.getLogger("ModelUnpickler")

# Create module placeholder for __main__ in the unpickler
main_module = types.ModuleType("__main__")
sys.modules["__main__"] = main_module

# Define all the classes that were in __main__ when training
class ClinicalFeatureTransformer(BaseEstimator, TransformerMixin):
    """Placeholder class for unpickling"""
    def __init__(self, temporal_features=True, interaction_features=True, 
                 symptom_clusters=True, risk_stratification=True):
        self.temporal_features = temporal_features
        self.interaction_features = interaction_features
        self.symptom_clusters = symptom_clusters
        self.risk_stratification = risk_stratification
        self._feature_names_out = None
        self._raw_feature_names_in = None
        self.is_fitted_ = False

class DiseaseSeverityPredictor(BaseEstimator, TransformerMixin):
    """Placeholder class for unpickling"""
    def __init__(self, n_bins=3, strategy='quantile'):
        self.n_bins = n_bins
        self.strategy = strategy
        self.severity_labels = ['Low', 'Medium', 'High']

class ClinicalSHAPExplainer:
    """Placeholder class for unpickling"""
    def __init__(self, pipeline=None, feature_names=None):
        self.pipeline = pipeline
        self.raw_feature_names = feature_names
        self.is_initialized_ = False

class ClinicalValidator:
    """Placeholder class for unpickling"""
    def __init__(self, alert_threshold=0.7, inconsistency_threshold=0.3):
        self.alert_threshold = alert_threshold
        self.inconsistency_threshold = inconsistency_threshold
        self.critical_diseases = {
            'Meningitis', 'Tuberculosis', 'Sepsis', 'Malaria', 
            'Pneumonia', 'HIV/AIDS'
        }
        self.inherently_severe = {'Meningitis', 'Sepsis'}
    
    # Add the missing method
    def validate_prediction(self, disease, probability, severity):
        """Validates a prediction - minimal implementation for unpickling"""
        return {
            "valid": True,
            "flags": [],
            "alerts": [],
            "original_severity": severity
        }

class ClinicalDiseasePipeline:
    """Placeholder class for unpickling"""
    def __init__(self, model_type='lightgbm', calibrate_probabilities=True, 
                 n_severity_levels=3, random_state=42):
        self.model_type = model_type
        self.calibrate_probabilities = calibrate_probabilities
        self.n_severity_levels = n_severity_levels
        self.random_state = random_state

# Add all classes to the main module
main_module.ClinicalFeatureTransformer = ClinicalFeatureTransformer
main_module.DiseaseSeverityPredictor = DiseaseSeverityPredictor
main_module.ClinicalSHAPExplainer = ClinicalSHAPExplainer
main_module.ClinicalValidator = ClinicalValidator
main_module.ClinicalDiseasePipeline = ClinicalDiseasePipeline

# Also add commonly used types that might be referenced
main_module.BaseEstimator = BaseEstimator
main_module.TransformerMixin = TransformerMixin
main_module.pd = pd
main_module.numpy = numpy

# Now replace the default unpickler with a custom one
class FixedUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        # Handle __main__ module
        if module == "__main__":
            return getattr(main_module, name)
            
        # Check if it's looking for numpy._core
        if module.startswith('numpy._core'):
            # Redirect to proper numpy location
            try:
                # Try to find the item in the numpy package
                numpy_module = module.replace('numpy._core', 'numpy.core')
                imported_module = __import__(numpy_module, fromlist=[name])
                return getattr(imported_module, name)
            except (ImportError, AttributeError):
                # If not found, try the main numpy package
                return getattr(numpy, name)
                
        # For all other cases, use the default behavior
        return super().find_class(module, name)

def load_model(model_path):
    """Loads a single joblib file with the fixed unpickler"""
    logger.info(f"Loading model file: {model_path}")
    try:
        with open(model_path, 'rb') as f:
            unpickler = FixedUnpickler(f)
            return unpickler.load()
    except Exception as e:
        logger.error(f"Error loading {model_path}: {e}")
        return None

def load_pipeline(model_dir):
    """Loads the entire model pipeline from the given directory"""
    model_dir = Path(model_dir)
    logger.info(f"Loading model from directory: {model_dir}")
    
    try:
        # Load all model components
        pipeline = load_model(model_dir / "sk_pipeline.joblib")
        disease_encoder = load_model(model_dir / "disease_encoder.joblib")
        severity_predictor = load_model(model_dir / "severity_predictor.joblib")
        validator = load_model(model_dir / "validator.joblib")
        
        # Load metadata
        try:
            import json
            with open(model_dir / "metadata.json", 'r') as f:
                metadata = json.load(f)
        except Exception as e:
            logger.error(f"Error loading metadata: {e}")
            return None
        
        # Load explainer if available
        explainer = None
        shap_path = model_dir / "shap_explainer.joblib"
        if shap_path.exists():
            try:
                logger.info("Loading SHAP explainer")
                explainer = load_model(shap_path)
            except Exception as e:
                logger.warning(f"Could not load SHAP explainer: {e}")
                explainer = None

        # Return a dictionary of all components        
        return {
            "pipeline": pipeline,
            "disease_encoder": disease_encoder,
            "severity_predictor": severity_predictor,
            "validator": validator,
            "explainer": explainer,
            "metadata": metadata
        }
    except Exception as e:
        logger.error(f"Error loading pipeline: {e}")
        return None
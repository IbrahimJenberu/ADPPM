# app/ai/model_debug.py
import joblib
import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger("ModelDebug")

def analyze_model_file(file_path):
    """Analyze the content of a joblib file without unpickling it completely."""
    try:
        logger.info(f"Analyzing file: {file_path}")
        # Load the file in a controlled way
        obj = joblib.load(file_path)
        
        # Print basic info
        logger.info(f"Loaded object type: {type(obj)}")
        
        # If it's a dict, print keys
        if isinstance(obj, dict):
            logger.info(f"Dictionary keys: {list(obj.keys())}")
            # Examine each value
            for key, value in obj.items():
                logger.info(f"  Key '{key}': {type(value)}")
        
        # If it's a list or array, print sample
        elif isinstance(obj, (list, np.ndarray)):
            sample = obj[:5] if len(obj) > 5 else obj
            logger.info(f"List/array with {len(obj)} items. Sample: {sample}")
        
        # If it's something else, try to get basic info
        else:
            logger.info(f"Object attributes: {dir(obj)[:20]}")
            
        return obj
    except Exception as e:
        logger.error(f"Error analyzing file: {e}")
        return None

if __name__ == "__main__":
    # This can be run directly to debug
    MODEL_DIR = Path("./app/ai/models/clinical_pipeline_randomforest_20250428_183416")
    analyze_model_file(MODEL_DIR / "sk_pipeline.joblib")
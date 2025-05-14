# app/ai/fix_model_files.py

"""Script to fix model files before loading."""
import logging
import os
import pickle
import joblib
import numpy as np
from pathlib import Path

logger = logging.getLogger("ModelFixer")

def fix_pickle_file(file_path):
    """Fix a pickle file to ensure proper class definition references."""
    try:
        # Read the file as bytes
        with open(file_path, 'rb') as f:
            content = f.read()
        
        # Replace `__main__` references with `app.ai.ml_pipeline`
        # This is the key fix that makes sure class definitions are found
        content = content.replace(
            b'c__main__\n', 
            b'capp.ai.ml_pipeline\n'
        )
        
        # Write the fixed content back
        fixed_path = str(file_path) + '.fixed'
        with open(fixed_path, 'wb') as f:
            f.write(content)
            
        # Replace the original with the fixed version
        os.replace(fixed_path, file_path)
        logger.info(f"Successfully fixed {file_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error fixing {file_path}: {e}")
        return False

def prepare_model_files(model_dir):
    """Fix all model files in the directory."""
    model_dir = Path(model_dir)
    
    # Create backup directory
    backup_dir = model_dir / "backup"
    backup_dir.mkdir(exist_ok=True)
    
    # Fix each joblib/pickle file
    for file_path in model_dir.glob("*.joblib"):
        try:
            # Create backup
            import shutil
            backup_path = backup_dir / file_path.name
            if not backup_path.exists():  # Only backup if not already done
                shutil.copy2(file_path, backup_path)
            
            # Fix the file
            fix_pickle_file(file_path)
                
        except Exception as e:
            logger.error(f"Failed to process {file_path}: {e}")
    
    # Also fix .pkl files if they exist
    for file_path in model_dir.glob("*.pkl"):
        try:
            backup_path = backup_dir / file_path.name
            if not backup_path.exists():
                import shutil
                shutil.copy2(file_path, backup_path)
            
            fix_pickle_file(file_path)
                
        except Exception as e:
            logger.error(f"Failed to process {file_path}: {e}")
            
    return True

# Add to the bottom
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    model_dir = sys.argv[1] if len(sys.argv) > 1 else "app/ai/models/clinical_pipeline_randomforest_20250428_183416"
    prepare_model_files(model_dir)
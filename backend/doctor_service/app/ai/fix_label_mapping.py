# app/ai/fix_label_mapping.py
import json
import logging
from pathlib import Path

logger = logging.getLogger("LabelMapFixer")

# Default disease labels that should always be available
DEFAULT_DISEASES = [
    'Common Cold', 
    'Diarrheal Disease', 
    'HIV/AIDS', 
    'Malaria', 
    'Meningitis', 
    'Pneumonia', 
    'Sepsis', 
    'Tuberculosis', 
    'Typhoid Fever'
]

def fix_label_mapping(model_dir):
    """Create or repair label mapping in metadata.json"""
    model_dir = Path(model_dir)
    metadata_file = model_dir / "metadata.json"
    
    try:
        # Read existing metadata
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
        else:
            logger.warning(f"No metadata.json found in {model_dir}, creating new one")
            metadata = {}
        
        # Check if label_mapping exists and has content
        if 'label_mapping' not in metadata or not metadata['label_mapping']:
            logger.warning("Label mapping missing or empty, creating default mapping")
            
            # Create default mapping
            label_mapping = {str(i): disease for i, disease in enumerate(DEFAULT_DISEASES)}
            metadata['label_mapping'] = label_mapping
            
            # Write updated metadata back
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Created default label mapping with {len(DEFAULT_DISEASES)} diseases")
            return True
        else:
            logger.info(f"Label mapping exists with {len(metadata['label_mapping'])} items")
            return False
            
    except Exception as e:
        logger.error(f"Error fixing label mapping: {e}")
        return False
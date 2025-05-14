# doctor_service/app/ai/fix_pickle.py
import pickle
import pathlib
import sys

def fix_pickle_files(model_dir):
    model_dir = pathlib.Path(model_dir)
    
    print(f"Fixing pickle files in {model_dir}")
    
    for pickle_file in model_dir.glob("*.joblib"):
        print(f"Processing {pickle_file}")
        
        # Read the file
        with open(pickle_file, 'rb') as f:
            content = f.read()
        
        # Replace __main__ with app.ai.ml_pipeline
        content = content.replace(
            b'c__main__\n', 
            b'capp.ai.ml_pipeline\n'
        )
        
        # Write back
        with open(pickle_file, 'wb') as f:
            f.write(content)
            
    print("Done fixing pickle files")

if __name__ == "__main__":
    model_dir = sys.argv[1] if len(sys.argv) > 1 else "app/ai/models/clinical_pipeline_randomforest_20250428_183416"
    fix_pickle_files(model_dir)
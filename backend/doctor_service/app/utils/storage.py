import uuid
import os
from fastapi import UploadFile, HTTPException
from typing import Optional
import logging
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

# Storage configuration
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "./storage"))
ALLOWED_FILE_TYPES = {
    "lab_request_file": ["pdf", "doc", "docx", "jpg", "jpeg", "png"],
    "medical_report": ["pdf", "txt"]
}

class StorageService:
    def __init__(self):
        self.storage_path = STORAGE_PATH
        self.storage_path.mkdir(parents=True, exist_ok=True)

    async def save_file_to_storage(
        self,
        file_content: bytes,
        original_filename: str,
        content_type: str,
        file_category: str
    ) -> str:
        """Save file to local storage and return file UUID"""
        try:
            # Validate file type
            allowed_types = ALLOWED_FILE_TYPES.get(file_category, [])
            if not allowed_types:
                raise ValueError(f"Invalid file category: {file_category}")
            
            file_extension = original_filename.split('.')[-1].lower()
            if file_extension not in allowed_types:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type for {file_category}. Allowed: {', '.join(allowed_types)}"
                )

            # Generate unique filename
            file_uuid = str(uuid.uuid4())
            filename = f"{file_uuid}.{file_extension}"
            file_path = self.storage_path / file_category / filename
            
            # Ensure directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save file
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            logger.info(f"File saved: {filename}")
            return file_uuid
        except Exception as e:
            logger.error(f"File save failed: {str(e)}")
            raise

    def get_file_url(self, file_id: str, file_category: str) -> Optional[str]:
        """Generate access URL for a stored file"""
        base_url = os.getenv("FILE_BASE_URL", "http://localhost:8000/files")
        return f"{base_url}/{file_category}/{file_id}"

# Singleton instance
storage_service = StorageService()

async def save_file_to_storage(*args, **kwargs) -> str:
    """Helper function for saving files"""
    return await storage_service.save_file_to_storage(*args, **kwargs)

def get_file_url(file_id: str, file_category: str) -> Optional[str]:
    """Helper function for generating file URLs"""
    return storage_service.get_file_url(file_id, file_category)
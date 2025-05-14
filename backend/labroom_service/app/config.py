import os
from typing import List, Optional, ClassVar
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Base settings
    APP_NAME: str = "ADPPM LabRoom Service"
    API_PREFIX: str = "/api" 
    DEBUG: bool = os.getenv("DEBUG", "False") == "True"
    
    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://labroom_user:labroom123@labroom_db:5432/labroom_db")
    DATABASE_MAX_CONNECTIONS: int = 10
    
    SERVICE_TOKEN: str = "your_jwt_token_here"
    SERVICE_ID: str = "your_registered_service_id"
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    
    # CORS settings
    CORS_ORIGINS: List[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # File storage settings
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/app/uploads")
    MAX_IMAGE_SIZE_MB: int = 5
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/dicom"]
    
    # Websocket settings
    WS_MESSAGE_QUEUE_SIZE: int = 100

    # Microservice URLs
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://auth_service:8022/api")
    CARDROOM_SERVICE_URL: str = os.getenv("CARDROOM_SERVICE_URL", "http://cardroom_service:8023/api")
    DOCTOR_SERVICE_URL: str = os.getenv("DOCTOR_SERVICE_URL", "http://doctor_service:8024")
    
    # Add WebSocket path
    DOCTOR_WS_URL: str = DOCTOR_SERVICE_URL.replace("http", "ws") + "/ws"

    # Not a field, just a static class var
    ENVIRONMENT: ClassVar[str] = os.getenv("ENVIRONMENT", "development")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

settings = Settings()

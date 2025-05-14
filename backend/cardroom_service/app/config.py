# cardroom_service/app/config.py
import os
from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any, List

class Settings(BaseSettings):
    """Application settings and environment variables."""
    APP_NAME: str = "ADPPM Cardroom Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database settings
    DATABASE_URL: str
    DB_MAX_CONNECTIONS: int = 10
    DB_MIN_CONNECTIONS: int = 5
    
    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Services
    AUTH_SERVICE_URL: str
    DOCTOR_SERVICE_URL: str
    #LABROOM_SERVICE_URL: Optional[str] = None
    SERVICE_TOKEN: str
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
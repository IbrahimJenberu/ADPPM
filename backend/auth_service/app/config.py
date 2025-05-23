# auth_service/app/config.py
import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "auth_service"
    ENV: str = os.getenv("ENV", "development")

    @property
    def smtp_configured(self) -> bool:
        """Check if SMTP is properly configured"""
        return (self.SMTP_SERVER and 
                self.SMTP_PORT and 
                self.SMTP_USERNAME and 
                self.SMTP_PASSWORD and
                self.EMAIL_FROM)
    
    def check_email_configuration(self) -> tuple[bool, str]:
        """Validate email configuration and return status with error message"""
        if not self.SMTP_SERVER:
            return False, "SMTP server not configured"
        if not self.SMTP_PORT:
            return False, "SMTP port not configured"
        if not self.SMTP_USERNAME:
            return False, "SMTP username not configured"
        if not self.SMTP_PASSWORD:
            return False, "SMTP password not configured"
        if not self.EMAIL_FROM:
            return False, "Email sender address not configured"
        return True, "Email configuration valid"

    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/auth_db")

    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-default-secret")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    JWT_ALGORITHM: str = "HS256"

    doctor_service_url: str = Field(..., env="DOCTOR_SERVICE_URL")
    labroom_service_url: str = Field("http://labroom_service:8025", env="LAB_SERVICE_URL")
    service_token: str = Field(default="", env="SERVICE_TOKEN")
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://frontend:5173",
        "http://localhost:8023"
    ]

    SMTP_SERVER: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("FROM_EMAIL", "noreply@adppm.com")

    VALID_ROLES: List[str] = ["admin", "doctor", "labroom", "cardroom"]

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        if not v or not v.startswith("postgresql://"):
            raise ValueError("DATABASE_URL must be a valid PostgreSQL URL")
        return v

settings = Settings()

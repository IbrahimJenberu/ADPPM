# auth_service/app/security_config.py
from pydantic_settings import BaseSettings
from typing import List, Dict, Any, Optional
import os

class SecuritySettings(BaseSettings):
    secret_key: str = os.getenv("SECRET_KEY", "your-default-secret")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # MFA Settings
    mfa_issuer: str = "ADPPM Auth"
    enforce_mfa_for_roles: List[str] = ["admin"]
    
    # Password Settings
    minimum_password_score: int = 5
    password_validation_disabled: bool = False
    
    # Token Settings
    enforce_token_binding: bool = True
    use_token_blacklist: bool = True
    
    # Email Verification
    require_email_verification: bool = True
    
    # OAuth Settings
    auth_base_url: str = os.getenv("AUTH_BASE_URL", "http://localhost:8000")
    
    # Role Permissions Mapping
    role_permissions: Dict[str, List[str]] = {
        "admin": [
            "user:read", "user:write", "user:create", "user:delete",
            "role:read", "role:write",
            "admin:access",
            "doctor:read", "doctor:write",
            "patient:read", "patient:write",
            "lab:read", "lab:write",
        ],
        "doctor": [
            "patient:read", "patient:write",
            "lab:read", "lab:request",
            "doctor:read",
        ],
        "labroom": [
            "lab:read", "lab:write",
            "patient:read",
            "doctor:read",
        ],
        "cardroom": [
            "patient:read", "patient:write",
            "doctor:read",
        ]
    }

security_settings = SecuritySettings()
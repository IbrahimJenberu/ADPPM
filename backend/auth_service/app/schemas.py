"""Pydantic schemas for request and response validation."""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import re
from uuid import UUID

from .config import settings

class Token(BaseModel):
    """Token response schema."""
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    role: str

class TokenPayload(BaseModel):
    """Token payload schema."""
    sub: Optional[str] = None
    exp: Optional[int] = None
    role: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=100)
    department: Optional[str] = Field(None, min_length=1, max_length=100)  # Changed to optional

class UserResponse(UserBase):
    id: UUID
    role: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_active: bool
    is_verified: bool
    
    class Config:
        schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "email": "user@example.com",
                "username": "doctor_john",
                "full_name": "John Doe",
                "department": "Cardiology",
                "role": "doctor",
                "created_at": "2023-04-20T12:00:00Z",
                "updated_at": "2023-04-20T12:00:00Z",
                "is_active": True,
                "is_verified": False
            }
        }

class UserCreate(UserBase):
    """Schema for user creation."""
    password: str = Field(..., min_length=8, max_length=100)
    role: str = Field(..., pattern=r'^(admin|doctor|labroom|cardroom)$')
    
    @validator('password')
    def password_strength(cls, v):
        """Validate password strength."""
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @validator('role')
    def role_valid(cls, v):
        """Validate role."""
        if v not in settings.VALID_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(settings.VALID_ROLES)}")
        return v

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(
        None, 
        description="New email address (must be unique)",
        example="new.email@example.com"
    )
    full_name: Optional[str] = Field(
        None, 
        min_length=1, 
        max_length=100,
        example="John Doe Updated"
    )
    department: Optional[str] = Field(
        None,
        min_length=1, 
        max_length=100,
        example="Updated Cardiology Department"
    )
    role: Optional[str] = Field(
        None,
        pattern=r'^(admin|doctor|labroom|cardroom)$',
        example="doctor"
    )
    is_active: Optional[bool] = Field(
        None,
        example=True
    )
    is_verified: Optional[bool] = Field(
        None,
        example=False
    )

    @validator('role')
    def validate_role(cls, v):
        if v is not None and v not in settings.VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of {settings.VALID_ROLES}")
        return v

    @validator('email')
    def validate_email(cls, v):
        if v and len(v) > 255:
            raise ValueError("Email must be less than 255 characters")
        return v


class UserList(BaseModel):
    """Schema for list of users with pagination."""
    items: List[UserResponse]
    total: int
    page: int
    size: int
    pages: int

class LoginRequest(BaseModel):
    """Schema for login requests."""
    username: str
    password: str

class RefreshTokenRequest(BaseModel):
    """Schema for refresh token requests."""
    refresh_token: str

class PasswordResetRequest(BaseModel):
    """Schema for password reset requests."""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation."""
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)
    
    @validator('new_password')
    def password_strength(cls, v):
        """Validate password strength."""
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one digit')
        return v

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)
    
    @validator('confirm_password')
    def passwords_match(cls, v, values):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class NotificationBase(BaseModel):
    """Base notification schema."""
    title: str
    message: str
    type: str
    data: Optional[Dict[str, Any]] = None

class NotificationCreate(NotificationBase):
    """Schema for creating notifications."""
    user_id: UUID

class NotificationResponse(NotificationBase):
    """Schema for notification responses."""
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime
    
    class Config:
        """Pydantic config."""
        from_attributes = True

class NotificationList(BaseModel):
    """Schema for list of notifications with pagination."""
    items: List[NotificationResponse]
    total: int
    page: int
    size: int
    pages: int

class WebSocketMessage(BaseModel):
    """Schema for WebSocket messages."""
    type: str
    data: Dict[str, Any]
    
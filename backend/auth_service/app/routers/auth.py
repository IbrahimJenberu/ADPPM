"""Authentication routes."""
from fastapi import APIRouter, Depends, Body, status, HTTPException
import asyncpg
import logging
from datetime import datetime, timedelta
import secrets
import jwt
from jose import JWTError  # Corrected casing
from typing import Dict, Any
import uuid
#

from ..models import UserModel, PasswordResetModel, RefreshTokenModel
from ..schemas import (
    UserCreate, UserResponse, Token, 
    LoginRequest, RefreshTokenRequest,
    PasswordResetRequest, PasswordResetConfirm
)
from ..security import (
    verify_password, get_password_hash, 
    create_access_token, create_refresh_token, 
    decode_token
)
from ..dependencies import get_db_conn, log_activity
from ..exceptions import (
    InvalidCredentialsException, ResourceExistsException,
    InvalidTokenException, ResourceNotFoundException
)
from ..email import send_password_reset_email, send_welcome_email
from ..security_config import security_settings

# Set up logging
logger = logging.getLogger("auth_service.routes.auth")

# Create router
router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserCreate,
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Register a new user.
    
    Args:
        user_data: User registration data
        conn: Database connection
        
    Returns:
        Created user
        
    Raises:
        ResourceExistsException: If email or username already exists
    """
    # Check if email exists
    email_exists = await UserModel.check_email_exists(conn, user_data.email)
    if email_exists:
        raise ResourceExistsException("Email")
    
    # Check if username exists
    username_exists = await UserModel.check_username_exists(conn, user_data.username)
    if username_exists:
        raise ResourceExistsException("Username")
    
    # Hash password
    password_hash = get_password_hash(user_data.password)
    
    # Create user
    user = await UserModel.create_user(
        conn,
        user_data.email,
        user_data.username,
        password_hash,
        user_data.full_name,
        user_data.department,
        user_data.role
    )
    
    # Send welcome email (non-blocking)
    try:
        await send_welcome_email(user_data.email, user_data.username)
    except Exception as e:
        logger.error(f"Error sending welcome email: {e}")
        # Continue even if email fails
    
    return user

@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Authenticate a user and return tokens.
    
    Args:
        login_data: Login credentials
        conn: Database connection
        
    Returns:
        Access and refresh tokens
        
    Raises:
        InvalidCredentialsException: If credentials are invalid
    """
    # Try to get user by username
    user = await UserModel.get_user_by_username(conn, login_data.username)
    
    # If not found, try by email
    if not user:
        user = await UserModel.get_user_by_email(conn, login_data.username)
    
    # Verify credentials
    if not user or not verify_password(login_data.password, user["password_hash"]):
        logger.warning(f"Failed login attempt for username/email: {login_data.username}")
        raise InvalidCredentialsException()
    
    # Create access token
    access_token_expires = timedelta(minutes=security_settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    # Create refresh token
    refresh_token = create_refresh_token(str(user["id"]))
    
    # Store refresh token in database
    refresh_token_expires = datetime.utcnow() + timedelta(days=security_settings.refresh_token_expire_days)
    await RefreshTokenModel.create_refresh_token(
        conn, 
        user["id"], 
        refresh_token, 
        refresh_token_expires
    )
    
    # Log successful login
    logger.info(f"Successful login for user: {user['username']}")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": security_settings.access_token_expire_minutes * 60,
        "role": user["role"]
    }

@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Refresh access token using a refresh token.
    
    Args:
        refresh_data: Refresh token data
        conn: Database connection
        
    Returns:
        New access and refresh tokens
        
    Raises:
        InvalidTokenException: If refresh token is invalid or expired
    """
    # Verify refresh token
    token_record = await RefreshTokenModel.get_valid_refresh_token(
        conn, 
        refresh_data.refresh_token
    )
    
    if not token_record:
        logger.warning("Invalid refresh token attempt")
        raise InvalidTokenException()
    
    # Get user
    user = await UserModel.get_user_by_id(conn, token_record["user_id"])
    if not user:
        logger.error(f"User not found for valid refresh token: {token_record['id']}")
        raise InvalidTokenException()
    
    # Create new access token
    access_token_expires = timedelta(minutes=security_settings.access_token_expire_minutes)
    # In login endpoint, change sub to user ID
    access_token = create_access_token(
        data={"sub": str(user["id"]), "role": user["role"]},  # Changed from username to ID
        expires_delta=access_token_expires
    )
    
    # Create new refresh token
    new_refresh_token = create_refresh_token(user["id"])
    
    # Store new refresh token
    refresh_token_expires = datetime.utcnow() + timedelta(days=security_settings.refresh_token_expire_days)
    await RefreshTokenModel.create_refresh_token(
        conn, 
        user["id"], 
        new_refresh_token, 
        refresh_token_expires
    )
    
    # Revoke old refresh token
    await RefreshTokenModel.revoke_token(conn, token_record["id"])
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": security_settings.access_token_expire_minutes * 60,
        "role": user["role"]
    }

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    refresh_token: str = Body(..., embed=True),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Logout a user by revoking their refresh token.
    
    Args:
        refresh_token: Refresh token to revoke
        conn: Database connection
    """
    # Get token record
    token_record = await RefreshTokenModel.get_valid_refresh_token(conn, refresh_token)
    
    # Revoke token if found
    if token_record:
        await RefreshTokenModel.revoke_token(conn, token_record["id"])
        logger.info(f"User logged out: {token_record['user_id']}")

@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(
    reset_data: PasswordResetRequest,
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Request a password reset.
    
    Args:
        reset_data: Password reset request data
        conn: Database connection
        
    Returns:
        Status message
    """
    # Find user by email
    user = await UserModel.get_user_by_email(conn, reset_data.email)
    
    # If user exists, create reset token
    if user:
        # Generate token
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # Store token
        await PasswordResetModel.create_reset_token(
            conn,
            user["id"],
            token,
            expires_at
        )
        
        # Send email
        await send_password_reset_email(user["email"], token)
        
        logger.info(f"Password reset requested for: {user['email']}")
    
    # Always return success to prevent email enumeration
    return {"message": "Password reset instructions sent if email exists"}

@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Confirm a password reset.
    
    Args:
        reset_data: Password reset confirmation data
        conn: Database connection
        
    Returns:
        Status message
        
    Raises:
        InvalidTokenException: If token is invalid or expired
    """
    # Find token
    token_record = await PasswordResetModel.get_valid_reset_token(
        conn,
        reset_data.token
    )
    
    if not token_record:
        raise InvalidTokenException()
    
    # Get user
    user = await UserModel.get_user_by_id(conn, token_record["user_id"])
    if not user:
        raise ResourceNotFoundException("User")
    
    # Update password
    password_hash = get_password_hash(reset_data.new_password)
    success = await UserModel.update_password(conn, user["id"], password_hash)
    
    if not success:
        logger.error(f"Failed to update password for user: {user['id']}")
        raise InvalidTokenException()
    
    # Mark token as used
    await PasswordResetModel.mark_token_used(conn, token_record["id"])
    
    # Revoke all refresh tokens for this user
    await RefreshTokenModel.revoke_all_user_tokens(conn, user["id"])
    
    logger.info(f"Password reset successful for user: {user['email']}")
    
    return {"message": "Password has been successfully reset"}

# Add to your auth routes
@router.post("/validate-token", response_model=UserResponse)
async def validate_token_endpoint(
    request: dict = Body(...),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Validate a JWT token and return user information.
    """
    token = request.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    try:
        # Decode the token to get user ID
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise InvalidCredentialsException()

        # Get user from database
        user = await UserModel.get_user_by_id(conn, user_id)
        if not user:
            raise InvalidCredentialsException()

        return user
    except JWTError as e:
        logger.error(f"Token validation error: {str(e)}")
        raise InvalidCredentialsException()
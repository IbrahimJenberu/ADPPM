"""User management routes."""
from fastapi import APIRouter, Depends, status, Query, Path, HTTPException, BackgroundTasks, Request
import asyncpg
import httpx
import logging
from typing import Dict, Any, Optional, List
import uuid
from math import ceil

from ..models import UserModel, RefreshTokenModel
from ..schemas import (
    UserResponse, UserCreate, UserUpdate, UserList,
    ChangePasswordRequest
)
from ..dependencies import (
    get_db_conn, get_current_active_user, is_admin,
    has_role, log_activity
)
from ..exceptions import (
    UserNotFoundException, ResourceExistsException,
    InvalidCredentialsException, ResourceNotFoundException
)
from ..security import verify_password, get_password_hash, any_authenticated_user
from ..config import settings
from ..analytics.middleware import route_analytics

# Set up logging
logger = logging.getLogger("auth_service.routes.users")

# Create router
router = APIRouter()

async def sync_user_to_doctor_service(user_data: dict):
    """Background task to sync user data with doctor service"""
    url = f"{settings.doctor_service_url}/sync/users"
    
    # Check if service_token exists and is not empty
    if not settings.service_token or settings.service_token.strip() == "":
        logger.error("Service token is empty or not configured")
        return
        
    headers = {"Authorization": f"Bearer {settings.service_token.strip()}"}
    logger.info(f"Syncing user to doctor service at URL: {url}")
    logger.debug(f"User data being synced: {user_data}")
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            logger.debug("Sending HTTP request...")
            response = await client.post(url, json=user_data, headers=headers)
            logger.debug(f"Received response status: {response.status_code}")
            response.raise_for_status()
            logger.info(f"Successfully synced user {user_data.get('id')} to doctor service")
    except httpx.HTTPStatusError as e:
        logger.error(f"Sync failed: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        logger.error(f"Sync error: {str(e)}")
                
async def sync_user_to_labroom_service(user_data: dict):
    """Background task to sync user data with labroom service"""
    url = f"{settings.labroom_service_url}/sync/users"
    
    # Check if service_token exists and is not empty
    if not settings.service_token or settings.service_token.strip() == "":
        logger.error("Service token is empty or not configured")
        return
        
    headers = {"Authorization": f"Bearer {settings.service_token.strip()}"}
    logger.info(f"Syncing user to labroom service at URL: {url}")
    logger.debug(f"User data being synced: {user_data}")
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            logger.debug("Sending HTTP request...")
            response = await client.post(url, json=user_data, headers=headers)
            logger.debug(f"Received response status: {response.status_code}")
            response.raise_for_status()
            logger.info(f"Successfully synced user {user_data.get('id')} to labroom service")
    except httpx.HTTPStatusError as e:
        logger.error(f"Sync failed: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        logger.error(f"Sync error: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    request: Request,
    current_user: Dict[str, Any] = Depends(get_current_active_user)
):
    """
    Get current user profile.
    
    Args:
        current_user: Current user dict
        
    Returns:
        User profile
    """
    async with route_analytics(request):
        return current_user

@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    request: Request,
    user_data: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Update current user profile.
    
    Args:
        user_data: User update data
        current_user: Current user dict
        conn: Database connection
        
    Returns:
        Updated user profile
        
    Raises:
        UserNotFoundException: If user not found
    """
    async with route_analytics(request):
        # Only update allowed fields
        updated_user = await UserModel.update_user(
            conn,
            current_user["id"],
            full_name=user_data.full_name if user_data.full_name is not None else None
        )
        
        if not updated_user:
            raise UserNotFoundException()
        
        return updated_user

@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    request: Request,
    password_data: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_active_user),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Change current user's password.
    
    Args:
        password_data: Password change data
        current_user: Current user dict
        conn: Database connection
        
    Returns:
        Status message
        
    Raises:
        InvalidCredentialsException: If current password is incorrect
    """
    async with route_analytics(request):
        # Verify current password
        if not verify_password(password_data.current_password, current_user["password_hash"]):
            raise InvalidCredentialsException()
        
        # Update password
        password_hash = get_password_hash(password_data.new_password)
        success = await UserModel.update_password(conn, current_user["id"], password_hash)
        
        if not success:
            logger.error(f"Failed to update password for user: {current_user['id']}")
            raise ResourceNotFoundException("User")
        
        return {"message": "Password updated successfully"}

@router.get("", response_model=UserList)
async def get_users(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    role: Optional[str] = Query(None),
    #current_user: Dict[str, Any] = Depends(get_current_active_user),  # only checks for valid, active user
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Get all users with pagination (any active user).

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        role: Filter by role (optional)
        current_user: Current user dict (must be active)
        conn: Database connection

    Returns:
        List of users with pagination
    """
    async with route_analytics(request):
        if role and role not in settings.VALID_ROLES:
            role = None

        users = await UserModel.get_all_users(conn, skip, limit, role)

        if role:
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM users WHERE role = $1 AND is_active = true",
                role
            )
        else:
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM users WHERE is_active = true"
            )

        pages = ceil(total / limit) if total > 0 else 1
        page = (skip // limit) + 1 if limit > 0 else 1

        return {
            "items": users,
            "total": total,
            "page": page,
            "size": limit,
            "pages": pages
        }

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    #current_user: Dict[str, Any] = Depends(has_role(["admin"])),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Create a new user (admin only).
    
    Args:
        user_data: User creation data
        current_user: Current user dict (admin only)
        conn: Database connection
        
    Returns:
        Created user
        
    Raises:
        ResourceExistsException: If email or username already exists
    """
    async with route_analytics(request):
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

        sync_data = {
            "id": str(user["id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "department": user.get("department"),
            "is_active": user["is_active"]
        }
        background_tasks.add_task(sync_user_to_doctor_service, sync_data)
        background_tasks.add_task(sync_user_to_labroom_service, sync_data)
        # Log action

        return user

@router.get("/doctors", response_model=List[UserResponse])
async def get_all_doctors(
    request: Request,
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """Get all users with the 'doctor' role including departments"""
    async with route_analytics(request):
        return await UserModel.get_by_role("doctor", conn)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    request: Request,
    user_id: uuid.UUID = Path(...),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"])),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Get user by ID (admin only).
    
    Args:
        user_id: User ID
        current_user: Current user dict (admin only)
        conn: Database connection
        
    Returns:
        User
        
    Raises:
        UserNotFoundException: If user not found
    """
    async with route_analytics(request):
        user = await UserModel.get_user_by_id(conn, str(user_id))
        
        if not user:
            raise UserNotFoundException()
        
        return user

@router.get("/by-role/{role}", response_model=List[UserResponse])
async def get_users_by_role(
    request: Request,
    role: str = Path(..., description="User role"),
    conn: asyncpg.Connection = Depends(get_db_conn),
    #token_data: Dict[str, Any] = Depends(any_authenticated_user)
):
    """Get all users with a specific role."""
    async with route_analytics(request):
        result = await UserModel.get_by_role(role, conn)
        return result

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    request: Request,
    user_data: UserUpdate,
    background_tasks: BackgroundTasks,
    user_id: uuid.UUID = Path(...),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"])),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Update user (admin only).
    
    Args:
        user_data: User update data
        user_id: User ID
        current_user: Current user dict (admin only)
        conn: Database connection
        
    Returns:
        Updated user
        
    Raises:
        UserNotFoundException: If user not found
        ResourceExistsException: If email already exists
    """
    async with route_analytics(request):
        # Check if user exists
        user = await UserModel.get_user_by_id(conn, str(user_id))
        if not user:
            raise UserNotFoundException()
        
        # Convert to dict and remove unset fields
        update_data = user_data.dict(exclude_unset=True)
        
        try:
            # Update user with all provided fields
            updated_user = await UserModel.update_user(
                conn,
                str(user_id),
                **update_data
            )
        except ResourceExistsException as e:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e)
            )

        if updated_user:
            sync_data = {
                "id": str(updated_user["id"]),
                "email": updated_user["email"],
                "full_name": updated_user["full_name"],
                "role": updated_user["role"],
                "department": updated_user.get("department"),
                "is_active": updated_user["is_active"]
            }
            background_tasks.add_task(sync_user_to_doctor_service, sync_data)
            background_tasks.add_task(sync_user_to_labroom_service, sync_data)
            
        if not updated_user:
            raise UserNotFoundException()
        
        return updated_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    request: Request,
    user_id: uuid.UUID = Path(...),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"])),
    conn: asyncpg.Connection = Depends(get_db_conn)
):
    """
    Delete user (soft delete) (admin only).
    
    Args:
        user_id: User ID
        current_user: Current user dict (admin only)
        conn: Database connection
        
    Raises:
        UserNotFoundException: If user not found
    """
    async with route_analytics(request):
        # Check if user exists
        user = await UserModel.get_user_by_id(conn, str(user_id))
        if not user:
            raise UserNotFoundException()
        
        # Soft delete user
        success = await UserModel.soft_delete_user(conn, str(user_id))
        if not success:
            raise UserNotFoundException()
        
        # Revoke all refresh tokens for this user
        await RefreshTokenModel.revoke_all_user_tokens(conn, str(user_id))
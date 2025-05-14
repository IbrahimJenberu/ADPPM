"""FastAPI dependencies for authentication and authorization."""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import Optional, Dict, Any, List
import logging
import asyncpg

from .database import get_db_pool
from .security import decode_token
from .models import UserModel
from .exceptions import InvalidCredentialsException, PermissionDeniedException
from .config import settings

# Set up logging
logger = logging.getLogger("auth_service.dependencies")

# Set up OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_db_conn():
    """
    Get a database connection from the pool.
    
    Yields:
        Database connection
    """
    pool = get_db_pool()
    async with pool.acquire() as conn:
        yield conn

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    conn: asyncpg.Connection = Depends(get_db_conn)
) -> Dict[str, Any]:
    """
    Get the current authenticated user from the token.
    
    Args:
        token: JWT token
        conn: Database connection
        
    Returns:
        User dict
    
    Raises:
        InvalidCredentialsException: If token is invalid or user not found
    """
    try:
        # Decode the token
        payload = decode_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise InvalidCredentialsException()
            
        # Get the user from the database
        user = await UserModel.get_user_by_username(conn, username)
        if user is None:
            raise InvalidCredentialsException()
            
        return user
        
    except JWTError:
        raise InvalidCredentialsException()

async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get the current active user.
    
    Args:
        current_user: Current user dict
        
    Returns:
        Active user dict
        
    Raises:
        HTTPException: If user is inactive
    """
    if not current_user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user

def has_role(required_roles: List[str]):
    """
    Dependency for role-based access control.
    
    Args:
        required_roles: List of roles that have access
        
    Returns:
        Dependency function
    """
    async def role_checker(
        current_user: Dict[str, Any] = Depends(get_current_active_user)
    ) -> Dict[str, Any]:
        """
        Check if user has one of the required roles.
        
        Args:
            current_user: Current user dict
            
        Returns:
            User dict if authorized
            
        Raises:
            PermissionDeniedException: If user lacks required role
        """
        user_role = current_user.get("role")
        if user_role not in required_roles:
            logger.warning(
                f"Access denied: User {current_user['username']} with role {user_role} "
                f"tried to access route requiring one of {required_roles}"
            )
            raise PermissionDeniedException()
        return current_user
        
    return role_checker

async def is_admin(
    current_user: Dict[str, Any] = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    Check if the current user is an admin.
    
    Args:
        current_user: Current user dict
        
    Returns:
        User dict if admin
        
    Raises:
        PermissionDeniedException: If user is not an admin
    """
    if current_user.get("role") != "admin":
        raise PermissionDeniedException()
    return current_user

def log_activity(action: str):
    """
    Log user activity.
    
    Args:
        action: Activity description
        
    Returns:
        Dependency function
    """
    async def activity_logger(
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_active_user),
        conn: asyncpg.Connection = Depends(get_db_conn)
    ):
        """
        Log user activity.
        
        Args:
            request: Request object
            current_user: Current user dict
            conn: Database connection
        """
        try:
            # Get client info
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            
            # Extract request details
            path = request.url.path
            method = request.method
            
            # Log to database
            await conn.execute("""
                INSERT INTO user_activity_log (user_id, action, details, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5)
            """,
                current_user["id"],
                action,
                {
                    "path": path,
                    "method": method
                },
                ip_address,
                user_agent
            )
        except Exception as e:
            logger.error(f"Error logging activity: {e}")
            # Don't raise exception, just log the error
    
    return activity_logger
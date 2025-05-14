"""
Common dependencies for FastAPI routes.
"""
from fastapi import Request, Depends, HTTPException, status
from asyncpg import Connection
from typing import AsyncGenerator
from app.database import get_pool
from app.security import any_authenticated_user, security, TokenValidator

async def get_db_connection(request: Request) -> AsyncGenerator[Connection, None]:
    """
    Get a database connection from the pool and attach it to the request state.
    This allows us to reuse the connection across the request.
    """
    pool = await get_pool()
    conn = await pool.acquire()
    
    try:
        # Store connection in request state
        request.state.connection = conn
        yield conn
    finally:
        # Release connection back to pool
        await pool.release(conn)

# cardroom_service/app/dependencies.py

async def get_transaction(
    conn: Connection = Depends(get_db_connection),
    # Remove the user dependency here as it's now handled by the route
) -> AsyncGenerator[Connection, None]:
    """
    Get a database connection with an active transaction.
    Authentication is now handled at the route level
    """
    tx = conn.transaction()
    await tx.start()
    
    try:
        yield conn
    except:
        await tx.rollback()
        raise
    else:
        await tx.commit()
        
async def get_current_active_user(
    token_data: dict = Depends(TokenValidator.validate_token)
) -> dict:
    """Dependency to get current active user"""
    if not token_data.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user"
        )
    return token_data


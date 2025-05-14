from fastapi import APIRouter, Depends, HTTPException, status, Header
import logging
from ..database import get_connection
from ..models import UserModel
from ..schemas import UserSync
import asyncpg

# Setup logging
logger = logging.getLogger("labroom_service.routes.sync")

router = APIRouter()

async def verify_service_token(authorization: str = Header(...)):
    from ..config import settings
    logger.debug(f"Received authorization header: {authorization}")
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid authorization header format. Must be 'Bearer {token}'"
        )
        
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty token provided"
        )
        
    if token != settings.SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid service token"
        )
    
    return True

@router.post("/users", status_code=status.HTTP_200_OK)
async def sync_user(
    user_data: UserSync,
    _ = Depends(verify_service_token),
    conn: asyncpg.Connection = Depends(get_connection)
):
    logger.info(f"Received sync request for user: {user_data.id}")
    
    try:
        existing_user = await UserModel.get_user_by_id(conn, user_data.id)
        
        if existing_user:
            logger.info(f"Updating existing user: {user_data.id}")
            updated_user = await UserModel.update_user(
                conn,
                user_data.id,
                email=user_data.email,
                full_name=user_data.full_name,
                role=user_data.role,
                department=user_data.department,
                is_active=user_data.is_active
            )
            return {"message": "User updated", "user": updated_user}
        else:
            logger.info(f"Creating new user: {user_data.id}")
            new_user = await UserModel.create_user(
                conn,
                user_data.id,
                user_data.email,
                user_data.full_name,
                user_data.role,
                user_data.department,
                user_data.is_active
            )
            return {"message": "User created", "user": new_user}
            
    except Exception as e:
        logger.error(f"Error processing sync request: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
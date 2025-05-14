# Add to labroom_service/app/utils/event_logger.py
import httpx
from typing import Dict, Any, Optional
import json
from app.dependencies import get_db_pool


async def log_lab_request_event(
    lab_request_id: str,
    event_type: str,
    details: Dict[str, Any],
    user_id: Optional[str] = None
):
    """Log lab request events to the database for tracking."""
    conn = await get_db_pool()
    
    try:
        query = """
        INSERT INTO lab_request_events 
        (lab_request_id, event_type, user_id, details)
        VALUES ($1, $2, $3, $4)
        """
        
        await conn.execute(
            query, 
            lab_request_id, 
            event_type, 
            user_id, 
            json.dumps(details, default=str)
        )
    finally:
        await conn.close()
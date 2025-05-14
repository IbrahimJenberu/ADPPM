# doctor_service/app/database/__init__.py

import asyncpg
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# Global application-level connection pool
_app_pool = None

async def get_app_pool():
    """Get the application-level connection pool."""
    global _app_pool
    if _app_pool is None:
        logger.info("Initializing application-level database pool")
        _app_pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60.0
        )
    return _app_pool

async def close_app_pool():
    """Close the application-level connection pool."""
    global _app_pool
    if _app_pool is not None:
        logger.info("Closing application-level database pool")
        await _app_pool.close()
        _app_pool = None
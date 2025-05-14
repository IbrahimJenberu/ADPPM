"""
Database connection utilities for asyncpg.
"""
import asyncpg
import logging
from typing import Optional
from app.config import settings

# Global connection pool
pool: Optional[asyncpg.Pool] = None

async def init_db():
    """Initialize the database connection pool."""
    global pool
    logging.info("Initializing database connection pool...")
    
    try:
        pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=settings.DB_MIN_CONNECTIONS,
            max_size=settings.DB_MAX_CONNECTIONS,
        )
        logging.info("Database connection pool initialized successfully")
        
        # Apply migrations/initial setup if needed
        await apply_migrations()
        
    except Exception as e:
        logging.error(f"Failed to initialize database: {str(e)}")
        raise

async def apply_migrations():
    """Apply database migrations as a single transaction."""
    try:
        async with pool.acquire() as conn:
            logging.info("Applying database migrations...")
            
            with open("app/database/init.sql", "r") as sql_file:
                migration_sql = sql_file.read()

            async with conn.transaction():
                await conn.execute(migration_sql)
            
            logging.info("Database migrations applied successfully")
    except Exception as e:
        logging.error(f"Migration failed: {str(e)}")
        raise

async def get_pool() -> asyncpg.Pool:
    """Get the database connection pool."""
    if pool is None:
        await init_db()
    return pool

async def close_db():
    """Close the database connection pool."""
    global pool
    if pool:
        logging.info("Closing database connection pool...")
        await pool.close()
        pool = None
        logging.info("Database connection pool closed")
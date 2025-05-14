"""Database connection and initialization."""
import asyncpg
import logging
from typing import Optional

from ..config import settings

# Set up logging
logger = logging.getLogger("auth_service.database")

# Global connection pool
db_pool: Optional[asyncpg.Pool] = None

async def init_db():
    """Initialize the database connection pool and tables."""
    global db_pool
    
    try:
        # Create connection pool
        logger.info("Creating database connection pool...")
        db_pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=5,
            max_size=20
        )
        
        # Initialize database schema
        async with db_pool.acquire() as conn:
            # Read and execute the schema initialization SQL
            with open("app/database/init.sql", "r") as f:
                schema_sql = f.read()
                await conn.execute(schema_sql)
                logger.info("Database schema initialized")
            
            # Check if admin user exists, create if not
            admin_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin' LIMIT 1)"
            )
            
            if not admin_exists:
                logger.info("Creating default admin user...")
                from ..security import get_password_hash
                import uuid
                from datetime import datetime
                
                # Create default admin account
                await conn.execute("""
                    INSERT INTO users (
                        id, 
                        email, 
                        username, 
                        password_hash, 
                        full_name, 
                        role, 
                        created_at,
                        is_active,
                        is_verified
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, 
                    str(uuid.uuid4()),
                    "admin@adppm.com",
                    "admin",
                    get_password_hash("admin123"),  # Default password (change in production!)
                    "System Administrator",
                    "admin",
                    datetime.utcnow(),
                    True,
                    True
                )
                logger.info("Default admin user created")
                
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
        raise

async def close_db():
    """Close the database connection pool."""
    global db_pool
    
    if db_pool:
        logger.info("Closing database connection pool...")
        await db_pool.close()
        db_pool = None

def get_db_pool():
    """Get the database connection pool."""
    if not db_pool:
        raise RuntimeError("Database connection pool not initialized")
    return db_pool
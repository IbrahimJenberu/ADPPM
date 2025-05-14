import os
import uuid
import asyncpg
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timezone
from ..config import settings

# Connection pool
pool: Optional[asyncpg.Pool] = None

async def get_connection():
    """Get a database connection from the pool"""
    if pool is None:
        await init_db()
    return await pool.acquire()

async def init_db():
    """Initialize the database connection pool and schema"""
    global pool
    try:
        # Create connection pool
        pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=5,
            max_size=settings.DATABASE_MAX_CONNECTIONS,
        )
        
        # Initialize schema
        async with pool.acquire() as conn:
            # Read and execute init.sql
            current_dir = os.path.dirname(os.path.abspath(__file__))
            init_sql_path = os.path.join(current_dir, 'init.sql')
            
            with open(init_sql_path, 'r') as f:
                init_sql = f.read()
                await conn.execute(init_sql)
                
        print("Database initialized successfully")
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise

async def close_db():
    """Close the database connection pool"""
    global pool
    if pool:
        await pool.close()
        pool = None

# Helper functions for common database operations
async def execute_with_transaction(query: str, *args, conn=None):
    """Execute a query with a transaction"""
    should_release = False
    if not conn:
        conn = await pool.acquire()
        should_release = True
    
    tr = conn.transaction()
    try:
        await tr.start()
        result = await conn.execute(query, *args)
        await tr.commit()
        return result
    except Exception as e:
        await tr.rollback()
        raise e
    finally:
        if should_release and conn:
            await pool.release(conn)

async def fetch_one(query: str, *args, conn=None) -> Optional[Dict[str, Any]]:
    """Fetch a single row as a dictionary"""
    should_release = False
    if not conn:
        conn = await pool.acquire()
        should_release = True
        
    try:
        row = await conn.fetchrow(query, *args)
        if row:
            return dict(row)
        return None
    finally:
        if should_release and conn:
            await pool.release(conn)

async def fetch_all(query: str, *args, conn=None) -> List[Dict[str, Any]]:
    """Fetch all rows as dictionaries"""
    should_release = False
    if not conn:
        conn = await pool.acquire()
        should_release = True
        
    try:
        rows = await conn.fetch(query, *args)
        return [dict(row) for row in rows]
    finally:
        if should_release and conn:
            await pool.release(conn)

async def insert(table: str, data: Dict[str, Any], returning: str = "id", conn=None) -> Any:
    """Insert data into a table and return the specified column"""
    columns = list(data.keys())
    values = list(data.values())
    
    # Handle UUID objects
    for i, v in enumerate(values):
        if isinstance(v, uuid.UUID):
            values[i] = str(v)
    
    placeholders = [f'${i+1}' for i in range(len(values))]
    
    query = f"""
    INSERT INTO {table} ({', '.join(columns)})
    VALUES ({', '.join(placeholders)})
    RETURNING {returning}
    """
    
    should_release = False
    if not conn:
        conn = await pool.acquire()
        should_release = True
        
    try:
        result = await conn.fetchval(query, *values)
        return result
    finally:
        if should_release and conn:
            await pool.release(conn)

async def update(table: str, id_value: Union[uuid.UUID, str], data: Dict[str, Any], id_field: str = "id", conn=None) -> bool:
    """Update a record in a table"""
    if isinstance(id_value, uuid.UUID):
        id_value = str(id_value)
        
    set_clause = []
    values = []
    
    for i, (key, value) in enumerate(data.items(), start=1):
        set_clause.append(f"{key} = ${i}")
        if isinstance(value, uuid.UUID):
            values.append(str(value))
        else:
            values.append(value)
    
    values.append(id_value)
    placeholder_index = len(values)
    
    query = f"""
    UPDATE {table}
    SET {', '.join(set_clause)}, updated_at = NOW()
    WHERE {id_field} = ${placeholder_index}
    """
    
    should_release = False
    if not conn:
        conn = await pool.acquire()
        should_release = True
        
    try:
        result = await conn.execute(query, *values)
        return 'UPDATE' in result
    finally:
        if should_release and conn:
            await pool.release(conn)

async def soft_delete(table: str, id_value: Union[uuid.UUID, str], id_field: str = "id", conn=None) -> bool:
    """Soft delete a record by setting is_deleted to TRUE"""
    if isinstance(id_value, uuid.UUID):
        id_value = str(id_value)
        
    query = f"""
    UPDATE {table}
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE {id_field} = $1
    """
    
    should_release = False
    if not conn:
        conn = await pool.acquire()
        should_release = True
        
    try:
        result = await conn.execute(query, id_value)
        return 'UPDATE' in result
    finally:
        if should_release and conn:
            await pool.release(conn)
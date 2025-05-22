"""Database models and operations for cardroom service."""
import uuid
import json
from uuid import UUID
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from asyncpg import Pool, Connection, Record
from app.database import get_pool

# Type alias for database records
DBRecord = Dict[str, Any]

class BaseCRUD:
    """Base class for database operations"""
    table_name: str = ""
    
    @classmethod
    async def get_by_id(cls, id: uuid.UUID) -> Optional[DBRecord]:
        """Get a record by ID"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = f"""
                SELECT * FROM {cls.table_name}
                WHERE id = $1 AND is_deleted = FALSE
            """
            result = await conn.fetchrow(query, id)
            return dict(result) if result else None
    
    @classmethod
    async def create(cls, data: Dict[str, Any]) -> DBRecord:
        """Generic create method without patient-specific fields"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                columns = list(data.keys())
                values = list(data.values())
            
                placeholders = [f"${i+1}" for i in range(len(values))]
            
                query = f"""
                    INSERT INTO {cls.table_name} ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                    RETURNING *
                """
                result = await conn.fetchrow(query, *values)
                return dict(result)
    
    @classmethod
    async def update(cls, id: uuid.UUID, data: Dict[str, Any]) -> Optional[DBRecord]:
        """Update an existing record"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Remove id from data if present
                if 'id' in data:
                    del data['id']
                    
                if not data:
                    return await cls.get_by_id(id)
                
                # Handle JSON fields
                if 'allergies' in data and isinstance(data['allergies'], list):
                    data['allergies'] = json.dumps(data['allergies'])
                if 'medical_history' in data and isinstance(data['medical_history'], dict):
                    data['medical_history'] = json.dumps(data['medical_history'])
                    
                set_values = [f"{k} = ${i+2}" for i, k in enumerate(data.keys())]
                
                query = f"""
                    UPDATE {cls.table_name}
                    SET {', '.join(set_values)}, updated_at = NOW()
                    WHERE id = $1 AND is_deleted = FALSE
                    RETURNING *
                """
                
                result = await conn.fetchrow(query, id, *data.values())
                return dict(result) if result else None
                
    @classmethod
    async def delete(cls, id: uuid.UUID) -> bool:
        """Soft delete a record"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                query = f"""
                    UPDATE {cls.table_name}
                    SET is_deleted = TRUE, updated_at = NOW()
                    WHERE id = $1 AND is_deleted = FALSE
                    RETURNING id
                """
                result = await conn.fetchrow(query, id)
                return result is not None

    @classmethod
    async def list(cls, limit: int = 100, offset: int = 0, **filters) -> Tuple[List[DBRecord], int]:
        """List records with optional filters"""
        pool = await get_pool()
        
        # Build where clause from filters
        where_clauses = ["is_deleted = FALSE"]
        filter_values = []
        
        i = 1
        for key, value in filters.items():
            if value is not None:
                # Check if the key contains an operator
                if any(op in key for op in ['>=', '<=', '>', '<', '!=', ' LIKE ']):
                    where_clauses.append(f"{key} ${i}")  # Use the operator in the key
                else:
                    where_clauses.append(f"{key} = ${i}")  # Default to equality
                filter_values.append(value)
                i += 1
        
        where_clause = " AND ".join(where_clauses)
        
        async with pool.acquire() as conn:
            # Count total results
            count_query = f"""
                SELECT COUNT(*) FROM {cls.table_name}
                WHERE {where_clause}
            """
            total = await conn.fetchval(count_query, *filter_values)
            
            # Get paginated results
            query = f"""
                SELECT * FROM {cls.table_name}
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT ${i} OFFSET ${i+1}
            """
            results = await conn.fetch(query, *filter_values, limit, offset)
            
            return [dict(r) for r in results], total
        
    @classmethod
    async def upsert(cls, data: Dict[str, Any], conflict_column: str = "id") -> DBRecord:
        """Insert or update a record if conflict occurs on conflict_column"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                columns = list(data.keys())
                values = list(data.values())

                placeholders = [f"${i+1}" for i in range(len(values))]

                update_exprs = [f"{col} = EXCLUDED.{col}" for col in columns if col != conflict_column]

                query = f"""
                    INSERT INTO {cls.table_name} ({', '.join(columns)})
                    VALUES ({', '.join(placeholders)})
                    ON CONFLICT ({conflict_column}) DO UPDATE
                    SET {', '.join(update_exprs)}
                    RETURNING *
                """

                result = await conn.fetchrow(query, *values)
                return dict(result)


class PatientModel(BaseCRUD):
    """Patient database operations"""
    table_name = "patients"

    
        # In PatientModel class
    @classmethod
    async def create(cls, data: Dict[str, Any]) -> DBRecord:
        """Patient-specific create with medical field handling"""
        # Handle patient-specific fields
        if 'allergies' not in data or data['allergies'] is None:
            data['allergies'] = []
        if 'medical_history' not in data or data['medical_history'] is None:
            data['medical_history'] = {}

        # Convert to JSON
        if isinstance(data['allergies'], list):
            data['allergies'] = json.dumps(data['allergies'])
        if isinstance(data['medical_history'], dict):
            data['medical_history'] = json.dumps(data['medical_history'])
    
        return await super().create(data)
    
    @classmethod
    async def search_by_name(cls, name: str, limit: int = 20, offset: int = 0) -> Tuple[List[DBRecord], int]:
        """Search patients by name"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            # Using pattern matching with ILIKE for case-insensitive search
            pattern = f"%{name}%"
            
            # Count total results
            count_query = """
                SELECT COUNT(*) FROM patients
                WHERE (first_name ILIKE $1 OR last_name ILIKE $1) AND is_deleted = FALSE
            """
            total = await conn.fetchval(count_query, pattern)
            
            # Get paginated results
            query = """
                SELECT * FROM patients
                WHERE (first_name ILIKE $1 OR last_name ILIKE $1) AND is_deleted = FALSE
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            """
            results = await conn.fetch(query, pattern, limit, offset)
            
            return [dict(r) for r in results], total

# ... rest of your model classes ...

class OPDAssignmentModel(BaseCRUD):
    """OPD Assignment database operations"""
    table_name = "opd_assignments"
    
    @classmethod
    async def list(cls, limit: int, offset: int, **filters) -> Tuple[List[DBRecord], int]:
        """List records with joins and filters"""
        pool = await get_pool()
        
        # Build base query with joins
        base_query = """
            SELECT 
                o.*,
                d.full_name as doctor_name,
                d.department as doctor_specialty,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                p.registration_number as patient_registration
            FROM opd_assignments o
            JOIN doctors d ON o.doctor_id = d.id
            JOIN patients p ON o.patient_id = p.id
        """
        
        # Build where clauses
        where_clauses = ["o.is_deleted = FALSE"]
        filter_values = []
        
        for key, value in filters.items():
            if value is not None:
                where_clauses.append(f"o.{key} = ${len(filter_values)+1}")
                filter_values.append(value)
        
        where_clause = " AND ".join(where_clauses)
        
        async with pool.acquire() as conn:
            # Count total results
            count_query = f"""
                SELECT COUNT(*) FROM opd_assignments o
                WHERE {where_clause}
            """
            total = await conn.fetchval(count_query, *filter_values)
            
            # Get paginated results
            query = f"""
                {base_query}
                WHERE {where_clause}
                ORDER BY o.created_at DESC
                LIMIT ${len(filter_values)+1} OFFSET ${len(filter_values)+2}
            """
            results = await conn.fetch(query, *(filter_values + [limit, offset]))
            
            return [dict(r) for r in results], total

    @classmethod
    async def get_patient_assignments(cls, patient_id: uuid.UUID) -> List[DBRecord]:
        """Get all OPD assignments for a patient with doctor info"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    o.*,
                    d.full_name as doctor_name,
                    d.department as doctor_specialty,
                    p.registration_number as patient_registration
                FROM opd_assignments o
                JOIN doctors d ON o.doctor_id = d.id
                JOIN patients p ON o.patient_id = p.id
                WHERE o.patient_id = $1 AND o.is_deleted = FALSE
                ORDER BY o.created_at DESC
            """
            results = await conn.fetch(query, patient_id)
            return [dict(r) for r in results]

    @classmethod
    async def get_doctor_assignments(cls, doctor_id: uuid.UUID) -> List[DBRecord]:
        """Get all patients assigned to a doctor with full details"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    o.*,
                    d.full_name as doctor_name,
                    d.department as doctor_specialty,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    p.registration_number as patient_registration,
                    p.date_of_birth,
                    p.gender,
                    p.phone_number
                FROM opd_assignments o
                JOIN doctors d ON o.doctor_id = d.id
                JOIN patients p ON o.patient_id = p.id
                WHERE o.doctor_id = $1 AND o.is_deleted = FALSE
                ORDER BY o.created_at DESC
            """
            results = await conn.fetch(query, doctor_id)
            return [dict(r) for r in results]
    
    @classmethod
    async def get_by_id_with_joins(cls, assignment_id: uuid.UUID) -> Optional[DBRecord]:
        """Get an OPD assignment by ID with joined doctor and patient info."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    o.*, 
                    d.full_name as doctor_name,
                    d.department as doctor_specialty,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    p.registration_number as patient_registration
                FROM opd_assignments o
                JOIN doctors d ON o.doctor_id = d.id
                JOIN patients p ON o.patient_id = p.id
                WHERE o.id = $1 AND o.is_deleted = FALSE
            """
            result = await conn.fetchrow(query, assignment_id)
            return dict(result) if result else None
    

class AppointmentModel(BaseCRUD):
    """Appointment database operations"""
    table_name = "appointments"

    @classmethod
    async def create(cls, data: Dict[str, Any]) -> DBRecord:
        """Create appointment with status validation"""
        if "status" not in data:
            data["status"] = "SCHEDULED"
            
        return await super().create(data)
    
    # Other methods remain the same

    @classmethod
    async def get_by_id(cls, id: UUID) -> Optional[DBRecord]:
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    a.*,
                    d.full_name as doctor_name,
                    d.department as department,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    p.registration_number as patient_registration
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                JOIN patients p ON a.patient_id = p.id
                WHERE a.id = $1 AND a.is_deleted = FALSE
            """
            result = await conn.fetchrow(query, id)
            return dict(result) if result else None

    @classmethod
    async def update(cls, id: uuid.UUID, data: Dict[str, Any]) -> Optional[DBRecord]:
        """Update an existing record with proper return handling"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                if 'id' in data:
                    del data['id']
                    
                if not data:
                    return await cls.get_by_id(id)
                    
                set_values = [f"{k} = ${i+2}" for i, k in enumerate(data.keys())]
                
                query = f"""
                    UPDATE {cls.table_name}
                    SET {', '.join(set_values)}, updated_at = NOW()
                    WHERE id = $1 AND is_deleted = FALSE
                    RETURNING *
                """
                
                result = await conn.fetchrow(query, id, *data.values())
                return await cls.get_by_id(id)  # Always return full joined data

    @classmethod
    async def get_doctor_appointments(cls, doctor_id: UUID, start_date: datetime, end_date: datetime) -> List[DBRecord]:
        """Get doctor's schedule with patient details"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    a.*,
                    d.full_name as doctor_name,
                    d.department as department,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    p.registration_number as patient_registration,
                    p.phone_number,
                    p.date_of_birth
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN doctors d ON a.doctor_id = d.id
                WHERE a.doctor_id = $1 
                AND a.appointment_date >= $2 
                AND a.appointment_date <= $3
                AND a.is_deleted = FALSE
                ORDER BY a.appointment_date ASC
            """
            results = await conn.fetch(query, doctor_id, start_date, end_date)
            return [dict(r) for r in results]

    @classmethod
    async def get_patient_appointments(cls, patient_id: uuid.UUID) -> List[DBRecord]:
        """Get all appointments for a patient"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    a.*,
                    d.full_name as doctor_name,
                    d.department as department,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    p.registration_number as patient_registration
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                JOIN patients p ON a.patient_id = p.id
                WHERE a.patient_id = $1 AND a.is_deleted = FALSE
                ORDER BY a.appointment_date DESC
            """
            results = await conn.fetch(query, patient_id)
            return [dict(r) for r in results]

    # Keep other methods (list, check_conflicts, etc.) properly indented here

    @classmethod
    async def list(cls, limit: int, offset: int, **filters) -> Tuple[List[DBRecord], int]:
        pool = await get_pool()
        base_query = """
            SELECT 
                a.*,
                d.full_name as doctor_name,
                d.department as department,  -- CORRECTED ALIAS
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                p.registration_number as patient_registration
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN patients p ON a.patient_id = p.id
        """
        # Rest of the method remains the same
        
        # Build where clauses
        where_clauses = ["a.is_deleted = FALSE"]
        filter_values = []
        
        for key, value in filters.items():
            if value is not None:
                where_clauses.append(f"a.{key} = ${len(filter_values)+1}")
                filter_values.append(value)
        
        where_clause = " AND ".join(where_clauses)
        
        async with pool.acquire() as conn:
            # Count total results with joins
            count_query = f"""
                SELECT COUNT(*)
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                JOIN patients p ON a.patient_id = p.id
                WHERE {where_clause}
            """
            total = await conn.fetchval(count_query, *filter_values)
            
            # Get paginated results
            query = f"""
                {base_query}
                WHERE {where_clause}
                ORDER BY a.created_at DESC
                LIMIT ${len(filter_values)+1} OFFSET ${len(filter_values)+2}
            """
            results = await conn.fetch(query, *(filter_values + [limit, offset]))
            
            return [dict(r) for r in results], total

    @classmethod
    async def check_conflicts(
        cls, 
        doctor_id: uuid.UUID, 
        appointment_date: datetime, 
        duration_minutes: int, 
        exclude_id: Optional[uuid.UUID] = None
    ) -> bool:
        """Check if there's a conflicting appointment for the given doctor and time."""
        pool = await get_pool()
        new_end = appointment_date + timedelta(minutes=duration_minutes)
    
        async with pool.acquire() as conn:
            query = """
                SELECT EXISTS (
                    SELECT 1 FROM appointments
                    WHERE doctor_id = $1
                    AND is_deleted = FALSE
                    AND id != COALESCE($4, uuid_nil())
                    AND (
                        appointment_date < $3  -- Existing appointment starts before new appointment ends
                        AND 
                        appointment_date + (duration_minutes * INTERVAL '1 minute') > $2  -- Existing appointment ends after new starts
                    )
                )
            """
            result = await conn.fetchval(query, doctor_id, appointment_date, new_end, exclude_id)
            return result


        
class DoctorModel(BaseCRUD):
    """Doctor database operations"""
    table_name = "doctors"

    @classmethod
    async def get_by_id(cls, id: uuid.UUID) -> Optional[DBRecord]:
        """Get a doctor by ID with basic info"""
        pool = await get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT id, full_name, department FROM doctors
                WHERE id = $1 AND is_deleted = FALSE
            """
            result = await conn.fetchrow(query, id)
            return dict(result) if result else None
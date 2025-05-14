# doctor_service/app/models.py
import uuid
import json
from fastapi import HTTPException, status
from datetime import datetime, date
import asyncpg
import logging
from typing import Optional, Dict, List, Any, Union
from app.notifications import create_notification_for_role
from app.exceptions import DatabaseException

logger = logging.getLogger(__name__)

class BaseModel:
    """Base model for all database models"""

    @classmethod
    async def create_table(cls, pool):
        """Create table if it doesn't exist"""
        pass

    @classmethod
    async def get_by_id(cls, pool, id: uuid.UUID):
        """Get a record by ID"""
        pass

    @staticmethod
    def row_to_dict(row):
        """Convert a database row to a dictionary"""
        if not row:
            return None
        return dict(row)


class UserModel:
    @staticmethod
    def row_to_dict(row):
        """Convert a database row to a dictionary"""
        if not row:
            return None
        return dict(row)

    @classmethod
    async def get_user_by_id(cls, conn, user_id):
        """Get a user by ID"""
        query = """
            SELECT * FROM users WHERE id = $1
        """
        record = await conn.fetchrow(query, user_id)
        return cls.row_to_dict(record)

    @classmethod
    async def create_user(
        cls, conn, user_id, email, full_name, role, department, is_active
    ):
        """Create a new user"""
        query = """
            INSERT INTO users (id, email, full_name, role, department, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        """
        record = await conn.fetchrow(
            query, user_id, email, full_name, role, department, is_active
        )
        return cls.row_to_dict(record)

    @classmethod
    async def update_user(cls, conn, user_id, **fields):
        """Update an existing user"""
        if not fields:
            return await cls.get_user_by_id(conn, user_id)

        set_clause = ", ".join([f"{k} = ${i+2}" for i, k in enumerate(fields.keys())])
        values = list(fields.values())
        query = f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = $1 RETURNING *"
        record = await conn.fetchrow(query, user_id, *values)
        return cls.row_to_dict(record)


# Update Patient model

class Patient:
    """Patient model for doctor operations"""

    @classmethod
    async def get_by_id(cls, pool, patient_id: uuid.UUID):
        async with pool.acquire() as conn:
            query = """
                SELECT * FROM patients 
                WHERE id = $1 AND is_active = true
            """
            record = await conn.fetchrow(query, patient_id)
            return cls.row_to_dict(record)

    @classmethod
    async def get_assigned_patients(cls, pool, doctor_id: uuid.UUID):
        async with pool.acquire() as conn:
            query = """
                SELECT p.* FROM patients p
                JOIN patient_doctor_assignments pda ON p.id = pda.patient_id
                WHERE pda.doctor_id = $1 AND p.is_active = true AND pda.is_active = true
                ORDER BY pda.assigned_at DESC
            """
            records = await conn.fetch(query, doctor_id)
            return [cls.row_to_dict(record) for record in records]
            
    @classmethod
    async def ensure_assignment(cls, pool, patient_id: uuid.UUID, doctor_id: uuid.UUID):
        """Ensure patient is assigned to doctor in local database"""
        async with pool.acquire() as conn:
            # Check if assignment already exists
            check_query = """
                SELECT id FROM patient_doctor_assignments
                WHERE patient_id = $1 AND doctor_id = $2 AND is_active = true
            """
            existing = await conn.fetchval(check_query, patient_id, doctor_id)
            
            if not existing:
                # Create assignment
                insert_query = """
                    INSERT INTO patient_doctor_assignments
                    (id, patient_id, doctor_id, assigned_at, is_active)
                    VALUES ($1, $2, $3, $4, true)
                """
                await conn.execute(
                    insert_query,
                    uuid.uuid4(),
                    patient_id,
                    doctor_id,
                    datetime.now()
                )

    @classmethod
    async def upsert_patient(cls, pool: asyncpg.Pool, patient_data: Dict[str, Any]) -> Dict:
        """Upsert patient with complete data from cardroom service"""
        try:
            # Get patient ID
            patient_id = patient_data.get('id')
            if isinstance(patient_id, str):
                patient_id = uuid.UUID(patient_id)
            elif not patient_id:
                patient_id = uuid.uuid4()
                logger.warning(f"Generated new UUID for patient: {patient_id}")
            
            # Extract date fields for proper handling
            birth_date = patient_data.get('date_of_birth')
            if birth_date:
                if isinstance(birth_date, str):
                    try:
                        from datetime import datetime
                        # Try to parse ISO format or similar
                        birth_date = datetime.fromisoformat(birth_date.replace('Z', '+00:00')).date()
                    except (ValueError, TypeError):
                        # Fallback to a simpler parsing
                        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                            try:
                                from datetime import datetime
                                birth_date = datetime.strptime(birth_date, fmt).date()
                                break
                            except ValueError:
                                continue
            
            # Handle JSON fields
            allergies = patient_data.get('allergies', [])
            medical_history = patient_data.get('medical_history', {})
            
            if isinstance(allergies, str):
                try:
                    allergies = json.loads(allergies)
                except json.JSONDecodeError:
                    allergies = []
                    
            if isinstance(medical_history, str):
                try:
                    medical_history = json.loads(medical_history)
                except json.JSONDecodeError:
                    medical_history = {}
            
            # Convert to JSON strings for PostgreSQL
            allergies_json = json.dumps(allergies)
            medical_history_json = json.dumps(medical_history)
            
            async with pool.acquire() as conn:
                # Check if patient exists
                exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM patients WHERE id = $1)",
                    patient_id
                )
                
                if exists:
                    # Update existing patient
                    query = """
                        UPDATE patients
                        SET 
                            registration_number = COALESCE($2, registration_number),
                            first_name = COALESCE($3, first_name),
                            last_name = COALESCE($4, last_name),
                            date_of_birth = COALESCE($5, date_of_birth),
                            gender = COALESCE($6, gender),
                            blood_group = COALESCE($7, blood_group),
                            phone_number = COALESCE($8, phone_number),
                            email = COALESCE($9, email),
                            address = COALESCE($10, address),
                            emergency_contact_name = COALESCE($11, emergency_contact_name),
                            emergency_contact_phone = COALESCE($12, emergency_contact_phone),
                            allergies = COALESCE($13::jsonb, allergies),
                            medical_history = COALESCE($14::jsonb, medical_history),
                            updated_at = NOW()
                        WHERE id = $1
                        RETURNING *
                    """
                    
                    record = await conn.fetchrow(
                        query,
                        patient_id,
                        patient_data.get('registration_number'),
                        patient_data.get('first_name') or patient_data.get('name', '').split(' ')[0],
                        patient_data.get('last_name') or ' '.join(patient_data.get('name', '').split(' ')[1:]),
                        birth_date,
                        patient_data.get('gender'),
                        patient_data.get('blood_group'),
                        patient_data.get('phone_number'),
                        patient_data.get('email'),
                        patient_data.get('address'),
                        patient_data.get('emergency_contact_name'),
                        patient_data.get('emergency_contact_phone'),
                        allergies_json,
                        medical_history_json
                    )
                else:
                    # Insert new patient
                    query = """
                        INSERT INTO patients (
                            id, registration_number, first_name, last_name, date_of_birth,
                            gender, blood_group, phone_number, email, address,
                            emergency_contact_name, emergency_contact_phone,
                            allergies, medical_history, created_at, updated_at, is_active
                        )
                        VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                            $13::jsonb, $14::jsonb, NOW(), NOW(), true
                        )
                        RETURNING *
                    """
                    
                    # Extract first/last name from name if needed
                    first_name = patient_data.get('first_name')
                    last_name = patient_data.get('last_name')
                    
                    if not first_name and not last_name and patient_data.get('name'):
                        name_parts = patient_data.get('name', '').split(' ')
                        first_name = name_parts[0]
                        last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
                    
                    record = await conn.fetchrow(
                        query,
                        patient_id,
                        patient_data.get('registration_number') or f"TEMP-{uuid.uuid4().hex[:8]}",
                        first_name or 'Unknown',
                        last_name or 'Unknown',
                        birth_date or datetime.now().date(),
                        patient_data.get('gender') or 'Unknown',
                        patient_data.get('blood_group'),
                        patient_data.get('phone_number') or 'Unknown',
                        patient_data.get('email'),
                        patient_data.get('address'),
                        patient_data.get('emergency_contact_name'),
                        patient_data.get('emergency_contact_phone'),
                        allergies_json,
                        medical_history_json
                    )
                
                # Ensure doctor-patient assignment is recorded if doctor_id is provided
                doctor_id = patient_data.get('doctor_id')
                if doctor_id:
                    if isinstance(doctor_id, str):
                        doctor_id = uuid.UUID(doctor_id)
                    
                    # Insert patient assignment
                    await conn.execute(
                        """
                        INSERT INTO patient_doctor_assignments
                        (id, patient_id, doctor_id, assigned_at, is_active)
                        VALUES ($1, $2, $3, NOW(), true)
                        ON CONFLICT (patient_id, doctor_id, is_active) DO NOTHING
                        """,
                        uuid.uuid4(), patient_id, doctor_id
                    )
                
                return cls.row_to_dict(record)
                
        except Exception as e:
            logger.error(f"Patient sync error: {e}", exc_info=True)
            # Return partial data rather than failing completely
            return patient_data
    
    @classmethod
    async def get_all_patients(cls, pool):
        async with pool.acquire() as conn:
            query = """
                SELECT * FROM patients WHERE is_active = true
                ORDER BY created_at DESC
            """
            records = await conn.fetch(query)
            return [cls.row_to_dict(record) for record in records]

    @staticmethod
    def parse_date(raw_date) -> date:
        """Convert various date formats to python date object"""
        if isinstance(raw_date, date):
            return raw_date
        if isinstance(raw_date, datetime):
            return raw_date.date()
        if isinstance(raw_date, str):
            # Try multiple date formats
            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                try:
                    return datetime.strptime(raw_date, fmt).date()
                except ValueError:
                    continue
        raise ValueError(f'Unsupported date format: {raw_date}')

    @staticmethod
    def row_to_dict(row):
        return dict(row) if row else None

class MedicalRecord:
    """Medical record model"""

    @classmethod
    async def create(
        cls,
        pool,
        patient_id: uuid.UUID,
        doctor_id: uuid.UUID,
        record_data: Dict[str, Any],
    ):
        async with pool.acquire() as conn:
            query = """
                INSERT INTO medical_records (
                    id, patient_id, doctor_id, diagnosis, treatment, notes, 
                    medications, vital_signs, follow_up_date
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9
                )
                RETURNING *
            """
            record_id = uuid.uuid4()

            # Extract and serialize vital_signs from record_data
            vital_signs = record_data.get("vital_signs", {})
            vital_signs_json = json.dumps(vital_signs)

            # Fetch other fields from record_data
            record = await conn.fetchrow(
                query,
                record_id,
                patient_id,
                doctor_id,
                record_data.get("diagnosis", ""),
                record_data.get("treatment", ""),
                record_data.get("notes", ""),
                record_data.get("medications", []),
                vital_signs_json,
                record_data.get("follow_up_date"),
            )

            return cls.row_to_dict(record)

    @classmethod
    async def get_by_id(
        cls, pool, record_id: uuid.UUID, patient_id: uuid.UUID, doctor_id: uuid.UUID
    ):
        """Get medical record with expanded authorization check"""
        async with pool.acquire() as conn:
            query = """
                SELECT mr.* 
                FROM medical_records mr
                LEFT JOIN patient_doctor_assignments pda 
                  ON mr.patient_id = pda.patient_id
                  AND pda.doctor_id = $3
                  AND pda.is_active = true
                WHERE mr.id = $1 
                  AND mr.patient_id = $2 
                  AND (mr.doctor_id = $3 OR pda.doctor_id IS NOT NULL)
                  AND mr.is_active = true
            """
            record = await conn.fetchrow(query, record_id, patient_id, doctor_id)
            return cls.row_to_dict(record)

    @classmethod
    async def update(
        cls,
        pool: asyncpg.Pool,
        record_id: uuid.UUID,
        patient_id: uuid.UUID,
        doctor_id: uuid.UUID,
        update_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update medical record with expanded permissions"""
        async with pool.acquire() as conn:
            # Verify access through either original creator or active assignment
            existing_record = await cls.get_by_id(
                pool, record_id, patient_id, doctor_id
            )
            if not existing_record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Medical record not found or unauthorized",
                )

            # Build update parameters
            set_clauses = []
            params = []
            for idx, (key, value) in enumerate(update_data.items(), start=1):
                if key == "vital_signs" and value is not None:
                    value = json.dumps(value)
                set_clauses.append(f"{key} = ${idx}")
                params.append(value)

            params.extend([record_id, patient_id])

            set_clause = ", ".join(set_clauses)
            query = f"""
                UPDATE medical_records
                SET {set_clause}, updated_at = NOW()
                WHERE id = ${len(params)-1}
                  AND patient_id = ${len(params)}
                RETURNING *
            """

            record = await conn.fetchrow(query, *params)
            return cls.row_to_dict(record)

    @classmethod
    async def get_patient_history(cls, pool, patient_id: uuid.UUID):
        async with pool.acquire() as conn:
            query = """
                SELECT mr.*, u.full_name as doctor_name
                FROM medical_records mr
                JOIN users u ON mr.doctor_id = u.id
                WHERE mr.patient_id = $1 AND mr.is_active = true
                ORDER BY mr.created_at DESC
            """
            records = await conn.fetch(query, patient_id)
            return [cls.row_to_dict(record) for record in records]

    @classmethod
    async def get_all_by_patient_doctor(
        cls, pool, patient_id: uuid.UUID, doctor_id: uuid.UUID
    ):
        """Get all medical records for a patient accessible by the doctor"""
        async with pool.acquire() as conn:
            query = """
                SELECT mr.* 
                FROM medical_records mr
                LEFT JOIN patient_doctor_assignments pda 
                    ON mr.patient_id = pda.patient_id
                    AND pda.doctor_id = $2
                    AND pda.is_active = true
                WHERE mr.patient_id = $1 
                    AND (mr.doctor_id = $2 OR pda.doctor_id IS NOT NULL)
                    AND mr.is_active = true
                ORDER BY mr.created_at DESC
            """
            records = await conn.fetch(query, patient_id, doctor_id)
            return [cls.row_to_dict(record) for record in records] if records else []

    @staticmethod
    def row_to_dict(row):
        if not row:
            return None
        result = dict(row)

        # Parse JSON fields
        if "vital_signs" in result and result["vital_signs"]:
            result["vital_signs"] = json.loads(result["vital_signs"])

        return result


class LabRequest:
    """Lab request model"""

    @classmethod
    async def create(cls, pool, patient_id, doctor_id, test_type, urgency, notes):
        async with pool.acquire() as conn:
            try:
                # Create a request ID explicitly
                request_id = uuid.uuid4()

                query = """
                    INSERT INTO lab_requests 
                        (id, patient_id, doctor_id, test_type, urgency, notes, status)
                    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                    RETURNING *;
                """

                # Ensure patient_id and doctor_id are UUID objects
                patient_id = (
                    patient_id
                    if isinstance(patient_id, uuid.UUID)
                    else uuid.UUID(str(patient_id))
                )
                doctor_id = (
                    doctor_id
                    if isinstance(doctor_id, uuid.UUID)
                    else uuid.UUID(str(doctor_id))
                )

                record = await conn.fetchrow(
                    query,
                    request_id,  # Explicitly provide request ID
                    patient_id,
                    doctor_id,
                    test_type,
                    urgency,
                    notes,
                )

                # Make sure we have a valid record before converting
                if not record:
                    raise DatabaseException(detail="No record returned after insert")

                # Convert the database record to a dictionary
                lab_request = cls.row_to_dict(record)

                # Create notification using string ID
                await create_notification_for_role(
                    pool,
                    "lab_technician",
                    "New Lab Request",
                    f"New {test_type} test requested with {urgency} urgency",
                    "new_lab_request",
                    str(request_id),  # Use the string representation of UUID
                )
                return lab_request
            except Exception as e:
                logging.error(f"Database Error: {str(e)}")
                raise DatabaseException(
                    detail=f"Failed to create lab request: {str(e)}"
                )

    @classmethod
    async def get_by_doctor(cls, pool, doctor_id: uuid.UUID):
        async with pool.acquire() as conn:
            query = """
                SELECT lr.*, p.first_name || ' ' || p.last_name as patient_name
                FROM lab_requests lr
                JOIN patients p ON lr.patient_id = p.id
                WHERE lr.doctor_id = $1 AND lr.is_active = true
                ORDER BY 
                    CASE lr.urgency 
                        WHEN 'high' THEN 1 
                        WHEN 'medium' THEN 2 
                        ELSE 3 
                    END,
                    lr.created_at DESC
            """
            records = await conn.fetch(query, doctor_id)
            return [cls.row_to_dict(record) for record in records]

    @staticmethod
    def row_to_dict(row):
        if not row:
            return None
        result = dict(row)
        # Convert UUIDs and dates to string formats
        for key in result:
            if isinstance(result[key], uuid.UUID):
                result[key] = str(result[key])
            elif isinstance(result[key], datetime):
                result[key] = result[key].isoformat()
        # Handle joined fields
        result["file_count"] = result.get("file_count", 0)
        return result


class Appointment:
    """Appointment model for doctor operations"""

    @classmethod
    async def get_doctor_appointments(
        cls, pool, doctor_id: uuid.UUID, date_from: date = None, date_to: date = None
    ):
        async with pool.acquire() as conn:
            params = [doctor_id]
            query = """
                SELECT a.*, p.first_name || ' ' || p.last_name as patient_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.doctor_id = $1 AND a.is_active = true
            """

            if date_from:
                params.append(date_from)
                query += f" AND a.appointment_date >= ${len(params)}"

            if date_to:
                params.append(date_to)
                query += f" AND a.appointment_date <= ${len(params)}"

            query += " ORDER BY a.appointment_date, a.appointment_time"

            records = await conn.fetch(query, *params)
            return [cls.row_to_dict(record) for record in records]

    # Add this method to your Appointment class in models.py

    @classmethod
    async def get_by_id(cls, pool, appointment_id: uuid.UUID):
        """Get appointment by ID"""
        async with pool.acquire() as conn:
            query = """
                SELECT a.*, p.first_name || ' ' || p.last_name as patient_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.id = $1 AND a.is_active = true
            """
            record = await conn.fetchrow(query, appointment_id)
            return cls.row_to_dict(record)

    @classmethod
    async def update_status(
        cls, pool, appointment_id: uuid.UUID, status: str, notes: Optional[str] = None
    ):
        async with pool.acquire() as conn:
            async with conn.transaction():
                query = """
                    UPDATE appointments
                    SET status = $1, notes = $2, updated_at = NOW()
                    WHERE id = $3 AND is_active = true
                    RETURNING *
                """

                record = await conn.fetchrow(query, status, notes, appointment_id)

                if not record:
                    return None

                # Create notification for card room worker
                notification_query = """
                    INSERT INTO notifications (
                        id, user_id, title, content, notification_type, related_id, is_read
                    )
                    SELECT
                        $1, 
                        u.id, 
                        $2, 
                        $3, 
                        'appointment_update', 
                        $4, 
                        false
                    FROM users u
                    WHERE u.role = 'card_room_worker' AND u.is_active = true
                """

                notification_id = uuid.uuid4()
                notification_title = f"Appointment {status.capitalize()}"
                notification_content = f"Appointment has been {status} by the doctor"

                await conn.execute(
                    notification_query,
                    notification_id,
                    notification_title,
                    notification_content,
                    appointment_id,
                )

                # Also notify the patient via email/SMS (would be implemented in a real system)

                return cls.row_to_dict(record)

    @staticmethod
    def row_to_dict(row):
        if not row:
            return None
        return dict(row)


# doctor_service/app/models.py


class MedicalReport(BaseModel):
    """Medical report model"""

    @classmethod
    async def create(
        cls,
        pool: asyncpg.Pool,
        patient_id: uuid.UUID,
        doctor_id: uuid.UUID,
        report_data: dict,
        format_type: str,
    ) -> dict:
        """Create a new medical report"""
        async with pool.acquire() as conn:
            try:
                # Option 1: Use a transaction with constraint modification
                async with conn.transaction():
                    # Temporarily disable foreign key constraints for this transaction
                    await conn.execute("SET CONSTRAINTS ALL DEFERRED")

                    query = """
                        INSERT INTO medical_reports (
                            id, patient_id, doctor_id, diagnosis, treatment, 
                            prescriptions, observations, recommendations, format_type,
                            report_content
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING *
                    """

                    report_id = uuid.uuid4()
                    # For now, store a placeholder content - real implementation would generate actual report
                    report_content = "Placeholder report content - to be generated"

                    record = await conn.fetchrow(
                        query,
                        report_id,
                        patient_id,
                        doctor_id,
                        report_data.get("diagnosis"),
                        report_data.get("treatment"),
                        report_data.get("prescriptions", []),
                        report_data.get("observations"),
                        report_data.get("recommendations"),
                        format_type,
                        report_content,
                    )

                    return cls.row_to_dict(record)
            except Exception as e:
                logging.error(f"Failed to generate report: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "error_code": "DOCTOR-004",
                        "message": f"Failed to generate report: {str(e)}",
                        "timestamp": datetime.now().isoformat(),
                    },
                )

    # In MedicalReport class
    @classmethod
    async def get_patient_reports(
        cls, pool: asyncpg.Pool, patient_id: uuid.UUID
    ) -> list:
        """Get all reports for a patient"""
        async with pool.acquire() as conn:
            query = """
                SELECT mr.*, u.full_name as doctor_name
                FROM medical_reports mr
                LEFT JOIN users u ON mr.doctor_id = u.id
                WHERE mr.patient_id = $1 AND mr.is_active = true
                ORDER BY mr.created_at DESC
            """
            records = await conn.fetch(query, patient_id)
            return [cls.row_to_dict(record) for record in records]

    @staticmethod
    def row_to_dict(row: asyncpg.Record) -> dict:
        """Convert database record to dictionary"""
        if not row:
            return None
        return dict(row)


# doctor_service/app/models/notification.py
import uuid
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
from asyncpg import Connection, Record


class NotificationModel(BaseModel):
    @classmethod
    async def create_table(cls, pool):
        """Create notifications table if it doesn't exist"""
        async with pool.acquire() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS notifications (
                    id UUID PRIMARY KEY,
                    recipient_id UUID NOT NULL,
                    message TEXT,
                    notification_type VARCHAR(50),
                    is_read BOOLEAN NOT NULL DEFAULT false,
                    read_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    FOREIGN KEY (recipient_id) REFERENCES users(id)
                )
            """
            )

    @classmethod
    async def create(cls, conn, data: dict):
        notification_id = uuid.uuid4()
        query = """
            INSERT INTO notifications 
                (id, recipient_id, message, notification_type, created_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        """
        record = await conn.fetchrow(
            query,
            notification_id,
            data["recipient_id"],
            data["message"],
            data["notification_type"],
            datetime.utcnow(),
        )
        return cls.row_to_dict(record)

    @classmethod
    async def get_user_notifications(cls, conn, user_id, limit, offset):
        query = """
            SELECT *, COUNT(*) OVER() as total
            FROM notifications
            WHERE recipient_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """
        records = await conn.fetch(query, user_id, limit, offset)
        if not records:
            return [], 0
        return [cls.row_to_dict(r) for r in records], records[0]["total"]

    @classmethod
    async def get_by_id(
        cls, conn: Connection, notification_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """Get notification by ID"""
        query = "SELECT * FROM notifications WHERE id = $1"
        record = await conn.fetchrow(query, notification_id)
        return cls.row_to_dict(record)

    @classmethod
    async def mark_as_read(
        cls, conn: Connection, notification_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """Mark a notification as read"""
        query = """
            UPDATE notifications
            SET is_read = true, read_at = NOW()
            WHERE id = $1
            RETURNING *
        """
        record = await conn.fetchrow(query, notification_id)
        return cls.row_to_dict(record)
    
# doctor_service/app/models.py
# Add this class to your models.py file

class LabResultNotification:
    """Model for tracking lab result notifications."""
    @classmethod
    async def create(
        cls,
        pool,
        doctor_id: uuid.UUID,
        lab_request_id: uuid.UUID,
        lab_result_id: uuid.UUID,
        notification_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a new lab result notification record."""
        async with pool.acquire() as conn:
            # Insert notification into database
            notification_id = uuid.uuid4()
            
            query = """
                INSERT INTO lab_result_notifications (
                    id, doctor_id, lab_request_id, lab_result_id, 
                    result_summary, is_read, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            """
            
            record = await conn.fetchrow(
                query,
                notification_id,
                doctor_id,
                lab_request_id,
                lab_result_id,
                json.dumps(notification_data.get("result_summary", {})),
                False,  # is_read
                datetime.now()
            )
            
            return cls.row_to_dict(record)
    
    @staticmethod
    def row_to_dict(row):
        """Convert a database row to a dictionary."""
        if not row:
            return None
        
        result = dict(row)
        
        # Parse JSON fields
        if "result_summary" in result and result["result_summary"]:
            try:
                result["result_summary"] = json.loads(result["result_summary"])
            except:
                result["result_summary"] = {}
                
        return result

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from enum import Enum

# Enums matching the database types
class TestStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TestPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class TestType(str, Enum):
    COMPLETE_BLOOD_COUNT = "complete_blood_count"
    COMPREHENSIVE_METABOLIC_PANEL = "comprehensive_metabolic_panel"
    LIPID_PANEL = "lipid_panel"
    LIVER_FUNCTION_TEST = "liver_function_test"
    THYROID_PANEL = "thyroid_panel"
    URINALYSIS = "urinalysis"
    HBA1C = "hba1c"
    CHEST_XRAY = "chest_xray"
    ECG = "ecg"
    COVID19_TEST = "covid19_test"
    ALLERGY_TEST = "allergy_test"
    VITAMIN_D_TEST = "vitamin_d_test"

class NotificationType(str, Enum):
    LAB_REQUEST_CREATED = "lab_request_created"
    LAB_REQUEST_UPDATED = "lab_request_updated"
    LAB_RESULT_READY = "lab_result_ready"
    TEST_DELAYED = "test_delayed"
    TEST_OVERDUE = "test_overdue"

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

# Model classes for database entities
class LabRequest:
    """Lab test request model."""
    def __init__(
        self,
        id: uuid.UUID,
        patient_id: uuid.UUID,
        doctor_id: uuid.UUID,
        technician_id: Optional[uuid.UUID],
        test_type: TestType,
        priority: TestPriority,
        status: TestStatus,
        notes: Optional[str],
        diagnosis_notes: Optional[str],
        created_at: datetime,
        updated_at: datetime,
        completed_at: Optional[datetime],
        due_date: Optional[datetime],
        is_deleted: bool = False,
        deleted_at: Optional[datetime] = None
    ):
        self.id = id
        self.patient_id = patient_id
        self.doctor_id = doctor_id
        self.technician_id = technician_id
        self.test_type = test_type
        self.priority = priority
        self.status = status
        self.notes = notes
        self.diagnosis_notes = diagnosis_notes
        self.created_at = created_at
        self.updated_at = updated_at
        self.completed_at = completed_at
        self.due_date = due_date
        self.is_deleted = is_deleted
        self.deleted_at = deleted_at
    
    @classmethod
    def from_db_row(cls, row: Dict[str, Any]):
        """Create a LabRequest instance from a database row."""
        if not row:
            return None
        
        # Convert string enum values to Enum types
        test_type = row.get("test_type")
        if isinstance(test_type, str):
            test_type = TestType(test_type)
        
        priority = row.get("priority")
        if isinstance(priority, str):
            priority = TestPriority(priority)
        
        status = row.get("status")
        if isinstance(status, str):
            status = TestStatus(status)
        
        return cls(
            id=row.get("id"),
            patient_id=row.get("patient_id"),
            doctor_id=row.get("doctor_id"),
            technician_id=row.get("technician_id"),
            test_type=test_type,
            priority=priority,
            status=status,
            notes=row.get("notes"),
            diagnosis_notes=row.get("diagnosis_notes"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
            completed_at=row.get("completed_at"),
            due_date=row.get("due_date"),
            is_deleted=row.get("is_deleted", False),
            deleted_at=row.get("deleted_at")
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the instance to a dictionary."""
        return {
            "id": str(self.id) if self.id else None,
            "patient_id": str(self.patient_id) if self.patient_id else None,
            "doctor_id": str(self.doctor_id) if self.doctor_id else None,
            "technician_id": str(self.technician_id) if self.technician_id else None,
            "test_type": self.test_type.value if self.test_type else None,
            "priority": self.priority.value if self.priority else None,
            "status": self.status.value if self.status else None,
            "notes": self.notes,
            "diagnosis_notes": self.diagnosis_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None
        }

class LabResult:
    """Lab test result model."""
    def __init__(
        self,
        id: uuid.UUID,
        lab_request_id: uuid.UUID,
        result_data: Dict[str, Any],
        conclusion: Optional[str],
        image_paths: Optional[List[str]],
        created_at: datetime,
        updated_at: datetime,
        is_deleted: bool = False,
        deleted_at: Optional[datetime] = None
    ):
        self.id = id
        self.lab_request_id = lab_request_id
        self.result_data = result_data
        self.conclusion = conclusion
        self.image_paths = image_paths or []
        self.created_at = created_at
        self.updated_at = updated_at
        self.is_deleted = is_deleted
        self.deleted_at = deleted_at
    
    @classmethod
    def from_db_row(cls, row: Dict[str, Any]):
        """Create a LabResult instance from a database row."""
        if not row:
            return None
        
        return cls(
            id=row.get("id"),
            lab_request_id=row.get("lab_request_id"),
            result_data=row.get("result_data", {}),
            conclusion=row.get("conclusion"),
            image_paths=row.get("image_paths", []),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
            is_deleted=row.get("is_deleted", False),
            deleted_at=row.get("deleted_at")
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the instance to a dictionary."""
        return {
            "id": str(self.id) if self.id else None,
            "lab_request_id": str(self.lab_request_id) if self.lab_request_id else None,
            "result_data": self.result_data,
            "conclusion": self.conclusion,
            "image_paths": self.image_paths,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None
        }

class Notification:
    """Notification model."""
    def __init__(
        self,
        id: uuid.UUID,
        recipient_id: uuid.UUID,
        sender_id: uuid.UUID,
        lab_request_id: Optional[uuid.UUID],
        lab_result_id: Optional[uuid.UUID],
        title: str,
        message: str,
        notification_type: NotificationType,
        is_read: bool = False,
        created_at: datetime = None,
        read_at: Optional[datetime] = None
    ):
        self.id = id
        self.recipient_id = recipient_id
        self.sender_id = sender_id
        self.lab_request_id = lab_request_id
        self.lab_result_id = lab_result_id
        self.title = title
        self.message = message
        self.notification_type = notification_type
        self.is_read = is_read
        self.created_at = created_at or datetime.now()
        self.read_at = read_at
    
    @classmethod
    def from_db_row(cls, row: Dict[str, Any]):
        """Create a Notification instance from a database row."""
        if not row:
            return None
        
        notification_type = row.get("notification_type")
        if isinstance(notification_type, str):
            notification_type = NotificationType(notification_type)
        
        return cls(
            id=row.get("id"),
            recipient_id=row.get("recipient_id"),
            sender_id=row.get("sender_id"),
            lab_request_id=row.get("lab_request_id"),
            lab_result_id=row.get("lab_result_id"),
            title=row.get("title"),
            message=row.get("message"),
            notification_type=notification_type,
            is_read=row.get("is_read", False),
            created_at=row.get("created_at"),
            read_at=row.get("read_at")
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the instance to a dictionary."""
        return {
            "id": str(self.id) if self.id else None,
            "recipient_id": str(self.recipient_id) if self.recipient_id else None,
            "sender_id": str(self.sender_id) if self.sender_id else None,
            "lab_request_id": str(self.lab_request_id) if self.lab_request_id else None,
            "lab_result_id": str(self.lab_result_id) if self.lab_result_id else None,
            "title": self.title,
            "message": self.message,
            "notification_type": self.notification_type.value if self.notification_type else None,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None
        }
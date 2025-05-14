import pytest
import uuid
import asyncio
from httpx import AsyncClient
import json
from datetime import datetime, timedelta

from app.main import app
from app.database import init_db, close_db
from app.models import TestType, TestPriority, TestStatus

# Mock JWT token for testing
MOCK_TECHNICIAN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVGVjaG5pY2lhbiIsInJvbGUiOiJsYWJfdGVjaG5pY2lhbiIsImV4cCI6MTY4MTQ2MDMyMH0.q31bTJQ3lPr3R5KgtHfAC_2aQHF-4YXLvULR3QQ5T7I"
MOCK_DOCTOR_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIiwibmFtZSI6IlRlc3QgRG9jdG9yIiwicm9sZSI6ImRvY3RvciIsImV4cCI6MTY4MTQ2MDMyMH0.F7zVnHgwqTLTjJVpjp-ihPjHlPONKNUOjWMwxbyLMCE"
MOCK_ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTU1NTU1NTU1IiwibmFtZSI6IlRlc3QgQWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE2ODE0NjAzMjB9.gVlnQ5YXipQvbCat6G26z6FnYBcTQXTuo7ONnp7Dw2E"

# Mock UUIDs
MOCK_PATIENT_ID = str(uuid.uuid4())
MOCK_DOCTOR_ID = str(uuid.uuid4())
MOCK_TECHNICIAN_ID = "1234567890"  # This matches the sub in the tech token

# Test data
TEST_LAB_REQUEST = {
    "patient_id": MOCK_PATIENT_ID,
    "doctor_id": MOCK_DOCTOR_ID,
    "test_type": TestType.BLOOD.value,
    "priority": TestPriority.ROUTINE.value,
    "notes": "Test lab request",
    "diagnosis_notes": "Patient needs blood work"
}

@pytest.fixture
async def client():
    """Create an async test client for the FastAPI app"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture(autouse=True)
async def setup_db():
    """Set up the database before tests and tear it down after"""
    await init_db()
    yield
    await close_db()

async def test_create_lab_request(client):
    """Test creating a lab request"""
    response = await client.post(
        "/api/v1/lab-requests/",
        json=TEST_LAB_REQUEST,
        headers={"Authorization": f"Bearer {MOCK_DOCTOR_TOKEN}"}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["patient_id"] == MOCK_PATIENT_ID
    assert data["test_type"] == TestType.BLOOD.value
    assert data["status"] == TestStatus.PENDING.value
    
    # Save the ID for other tests
    return data["id"]

async def test_get_lab_requests(client):
    """Test getting a list of lab requests"""
    # First create a lab request
    lab_request_id = await test_create_lab_request(client)
    
    # Now get the list
    response = await client.get(
        "/api/v1/lab-requests/",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 1
    
    # At least one item should match our created ID
    found = False
    for item in data["items"]:
        if item["id"] == lab_request_id:
            found = True
            break
    
    assert found, "Created lab request not found in list"

async def test_get_lab_request_by_id(client):
    """Test getting a lab request by ID"""
    # First create a lab request
    lab_request_id = await test_create_lab_request(client)
    
    # Now get it by ID
    response = await client.get(
        f"/api/v1/lab-requests/{lab_request_id}",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == lab_request_id
    assert data["patient_id"] == MOCK_PATIENT_ID
    assert data["test_type"] == TestType.BLOOD.value

async def test_update_lab_request(client):
    """Test updating a lab request"""
    # First create a lab request
    lab_request_id = await test_create_lab_request(client)
    
    # Now update it
    update_data = {
        "technician_id": MOCK_TECHNICIAN_ID,
        "status": TestStatus.IN_PROGRESS.value,
        "notes": "Updated notes"
    }
    
    response = await client.patch(
        f"/api/v1/lab-requests/{lab_request_id}",
        json=update_data,
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == lab_request_id
    assert data["status"] == TestStatus.IN_PROGRESS.value
    assert data["notes"] == "Updated notes"
    assert data["technician_id"] == MOCK_TECHNICIAN_ID

async def test_assign_lab_request(client):
    """Test assigning a lab request to a technician"""
    # First create a lab request
    lab_request_id = await test_create_lab_request(client)
    
    # Now assign it
    response = await client.post(
        f"/api/v1/lab-requests/{lab_request_id}/assign",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == lab_request_id
    assert data["status"] == TestStatus.IN_PROGRESS.value
    assert data["technician_id"] == MOCK_TECHNICIAN_ID

async def test_delete_lab_request(client):
    """Test deleting a lab request"""
    # First create a lab request
    lab_request_id = await test_create_lab_request(client)
    
    # Now delete it
    response = await client.delete(
        f"/api/v1/lab-requests/{lab_request_id}",
        headers={"Authorization": f"Bearer {MOCK_DOCTOR_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    
    # Verify it's deleted
    response = await client.get(
        f"/api/v1/lab-requests/{lab_request_id}",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 404
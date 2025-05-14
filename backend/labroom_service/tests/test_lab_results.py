import pytest
import uuid
import asyncio
from httpx import AsyncClient
import json
from datetime import datetime, timedelta
import os
import tempfile

from app.main import app
from app.database import init_db, close_db
from app.models import TestType, TestPriority, TestStatus

# Reuse mocks from lab requests tests
from tests.test_lab_requests import (
    MOCK_TECHNICIAN_TOKEN,
    MOCK_DOCTOR_TOKEN,
    MOCK_ADMIN_TOKEN,
    MOCK_PATIENT_ID,
    MOCK_DOCTOR_ID,
    MOCK_TECHNICIAN_ID,
    TEST_LAB_REQUEST,
    test_create_lab_request,
    test_update_lab_request
)

# Test data
TEST_LAB_RESULT = {
    "result_data": {
        "hemoglobin": 14.5,
        "wbc": 7000,
        "rbc": 5.2,
        "platelets": 250000
    },
    "conclusion": "Normal blood work results"
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

@pytest.fixture
async def assigned_lab_request(client):
    """Create a lab request and assign it to a technician"""
    # Create a lab request
    lab_request_id = await test_create_lab_request(client)
    
    # Assign it to a technician
    response = await client.post(
        f"/api/v1/lab-requests/{lab_request_id}/assign",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == TestStatus.IN_PROGRESS.value
    
    return data["id"]

async def test_create_lab_result(client, assigned_lab_request):
    """Test creating a lab result for an assigned request"""
    # Prepare result data
    result_data = dict(TEST_LAB_RESULT)
    result_data["lab_request_id"] = assigned_lab_request
    
    # Create the result
    response = await client.post(
        "/api/v1/lab-results/",
        json=result_data,
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["lab_request_id"] == assigned_lab_request
    assert data["conclusion"] == TEST_LAB_RESULT["conclusion"]
    
    # Check that the request status was updated to COMPLETED
    request_response = await client.get(
        f"/api/v1/lab-requests/{assigned_lab_request}",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert request_response.status_code == 200
    request_data = request_response.json()
    assert request_data["status"] == TestStatus.COMPLETED.value
    
    # Return the result ID for other tests
    return data["id"]

async def test_get_lab_result_by_id(client, assigned_lab_request):
    """Test getting a lab result by ID"""
    # First create a lab result
    result_id = await test_create_lab_result(client, assigned_lab_request)
    
    # Now get it by ID
    response = await client.get(
        f"/api/v1/lab-results/{result_id}",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == result_id
    assert data["lab_request_id"] == assigned_lab_request
    assert data["conclusion"] == TEST_LAB_RESULT["conclusion"]

async def test_update_lab_result(client, assigned_lab_request):
    """Test updating a lab result"""
    # First create a lab result
    result_id = await test_create_lab_result(client, assigned_lab_request)
    
    # Now update it
    update_data = {
        "result_data": {
            "hemoglobin": 15.0,
            "wbc": 7500,
            "rbc": 5.5,
            "platelets": 270000,
            "additional_metric": "test"
        },
        "conclusion": "Updated conclusion - results normal"
    }
    
    response = await client.patch(
        f"/api/v1/lab-results/{result_id}",
        json=update_data,
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == result_id
    assert data["conclusion"] == update_data["conclusion"]
    
    # Check that the updated result data contains the new value
    result_data = json.loads(data["result_data"]) if isinstance(data["result_data"], str) else data["result_data"]
    assert "additional_metric" in result_data
    assert result_data["additional_metric"] == "test"

async def test_delete_lab_result(client, assigned_lab_request):
    """Test deleting a lab result"""
    # First create a lab result
    result_id = await test_create_lab_result(client, assigned_lab_request)
    
    # Now delete it
    response = await client.delete(
        f"/api/v1/lab-results/{result_id}",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    
    # Verify it's deleted
    response = await client.get(
        f"/api/v1/lab-results/{result_id}",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert response.status_code == 404
    
    # Check that the request status was updated back to IN_PROGRESS
    request_response = await client.get(
        f"/api/v1/lab-requests/{assigned_lab_request}",
        headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
    )
    
    assert request_response.status_code == 200
    request_data = request_response.json()
    assert request_data["status"] == TestStatus.IN_PROGRESS.value

async def test_upload_image(client, assigned_lab_request):
    """Test uploading an image to a lab result"""
    # First create a lab result
    result_id = await test_create_lab_result(client, assigned_lab_request)
    
    # Create a temporary test image
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(b"test image content")
        tmp_path = tmp.name
    
    try:
        # Upload the image
        with open(tmp_path, "rb") as f:
            files = {"file": ("test_image.jpg", f, "image/jpeg")}
            response = await client.post(
                f"/api/v1/lab-results/{result_id}/upload-image",
                files=files,
                headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "file_path" in data
        assert data["file_name"].endswith(".jpg")
        assert data["content_type"] == "image/jpeg"
        
        # Verify the image path was added to the lab result
        result_response = await client.get(
            f"/api/v1/lab-results/{result_id}",
            headers={"Authorization": f"Bearer {MOCK_TECHNICIAN_TOKEN}"}
        )
        
        assert result_response.status_code == 200
        result_data = result_response.json()
        assert isinstance(result_data["image_paths"], list)
        assert len(result_data["image_paths"]) == 1
        assert result_data["image_paths"][0] == data["file_path"]
    finally:
        # Clean up
        os.unlink(tmp_path)
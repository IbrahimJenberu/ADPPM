"""
Tests for the patients module.
"""
import pytest
import uuid
from httpx import AsyncClient
from fastapi import status
from datetime import date

from app.main import app
from app.config import settings

# Test data
test_patient = {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": str(date(1990, 1, 1)),
    "gender": "MALE",
    "blood_group": "O+",
    "phone_number": "1234567890",
    "email": "johndoe@example.com",
    "address": "123 Main St",
    "emergency_contact_name": "Jane Doe",
    "emergency_contact_phone": "0987654321",
    "allergies": ["Penicillin"]
}

# Mock JWT token for testing
# In a real implementation, you would generate a valid token for testing
mock_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDU2Nzg5MCIsInJvbGUiOiJjYXJkX3Jvb21fd29ya2VyIn0.czQv86GtPbVNgSlTFZsP9nI-KCwbIgfjFOxYQGfWOVM"

@pytest.mark.asyncio
async def test_create_patient():
    """Test creating a new patient."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/patients/",
            json=test_patient,
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["first_name"] == test_patient["first_name"]
        assert data["last_name"] == test_patient["last_name"]
        assert "registration_number" in data
        assert "id" in data
        
        # Store ID for later tests
        patient_id = data["id"]
        
        # Test getting the patient
        response = await client.get(
            f"/api/patients/{patient_id}",
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == patient_id
        
        # Test updating the patient
        update_data = {
            "address": "456 New St",
            "phone_number": "5555555555"
        }
        
        response = await client.put(
            f"/api/patients/{patient_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["address"] == update_data["address"]
        assert data["phone_number"] == update_data["phone_number"]
        
        # Test patient search
        response = await client.post(
            "/api/patients/search",
            json={"query": "John"},
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        assert len(data["data"]) >= 1
        assert data["data"][0]["first_name"] == "John"
        
        # Test deleting the patient
        response = await client.delete(
            f"/api/patients/{patient_id}",
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify it's deleted (soft delete)
        response = await client.get(
            f"/api/patients/{patient_id}",
            headers={"Authorization": f"Bearer {mock_token}"}
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
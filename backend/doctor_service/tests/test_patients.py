import asyncio
import pytest
import uuid
from httpx import AsyncClient
from fastapi import FastAPI
import asyncpg
from unittest.mock import patch, AsyncMock

from app.main import app
from app.config import settings

# Test database settings
TEST_DB_NAME = "doctor_service_test"
TEST_DB_USER = settings.DB_USER
TEST_DB_PASSWORD = settings.DB_PASSWORD
TEST_DB_HOST = settings.DB_HOST
TEST_DB_PORT = settings.DB_PORT
TEST_DATABASE_URL = f"postgresql://{TEST_DB_USER}:{TEST_DB_PASSWORD}@{TEST_DB_HOST}:{TEST_DB_PORT}/{TEST_DB_NAME}"

# Mock JWT token
mock_doctor_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImRvY3RvciIsImV4cCI6MTkxNjIzOTAyMn0.3tP3BVNtsSA0KJIXu4YlvP8fUCgAzYwTO7F4NHnGk8E"

# Sample data
sample_doctor_id = uuid.uuid4()
sample_patient_id = uuid.uuid4()

@pytest.fixture
async def test_db_pool():
    # Create a test database
    sys_conn = await asyncpg.connect(
        user=TEST_DB_USER,
        password=TEST_DB_PASSWORD,
        host=TEST_DB_HOST,
        port=TEST_DB_PORT,
        database="postgres"
    )
    
    try:
        # Drop test database if it exists and create a new one
        await sys_conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB_NAME}")
        await sys_conn.execute(f"CREATE DATABASE {TEST_DB_NAME}")
        
    finally:
        await sys_conn.close()
    
    # Connect to test database and create schema
    pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL)
    
    try:
        async with pool.acquire() as conn:
            # Read and execute database initialization SQL
            with open("app/database/init.sql", "r") as f:
                init_sql = f.read()
                await conn.execute(init_sql)
                
            # Insert test data
            
            # Insert doctor user
            await conn.execute(
                """
                INSERT INTO users (id, email, password_hash, full_name, role, specialization)
                VALUES ($1, 'doctor@example.com', 'hashed_password', 'Test Doctor', 'doctor', 'Cardiology')
                """,
                sample_doctor_id
            )
            
            # Insert patient
            await conn.execute(
                """
                INSERT INTO patients (id, first_name, last_name, date_of_birth, gender, contact_number, email)
                VALUES ($1, 'John', 'Doe', '1990-01-01', 'Male', '1234567890', 'john.doe@example.com')
                """,
                sample_patient_id
            )
            
            # Assign patient to doctor
            await conn.execute(
                """
                INSERT INTO patient_doctor_assignments (patient_id, doctor_id)
                VALUES ($1, $2)
                """,
                sample_patient_id, sample_doctor_id
            )
                
        yield pool
        
    finally:
        await pool.close()
        
        # Drop test database
        sys_conn = await asyncpg.connect(
            user=TEST_DB_USER,
            password=TEST_DB_PASSWORD,
            host=TEST_DB_HOST,
            port=TEST_DB_PORT,
            database="postgres"
        )
        
        try:
            await sys_conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB_NAME}")
        finally:
            await sys_conn.close()

@pytest.fixture
def mock_get_current_doctor():
    # Mock the get_current_doctor dependency to return a test doctor
    return {"id": str(sample_doctor_id), "role": "doctor"}

@pytest.mark.asyncio
async def test_get_assigned_patients(test_db_pool, mock_get_current_doctor):
    # Mock dependencies
    app.dependency_overrides = {
        'app.dependencies.get_db_pool': lambda: test_db_pool,
        'app.dependencies.get_current_doctor': lambda: mock_get_current_doctor
    }
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Make request with mock token
        response = await client.get(
            "/patients",
            headers={"Authorization": f"Bearer {mock_doctor_token}"}
        )
        
        # Check response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total"] == 1
        
        # Check returned patient data
        patient = data["patients"][0]
        assert patient["id"] == str(sample_patient_id)
        assert patient["first_name"] == "John"
        assert patient["last_name"] == "Doe"

@pytest.mark.asyncio
async def test_get_patient(test_db_pool, mock_get_current_doctor):
    # Mock dependencies
    app.dependency_overrides = {
        'app.dependencies.get_db_pool': lambda: test_db_pool,
        'app.dependencies.get_current_doctor': lambda: mock_get_current_doctor,
        'app.dependencies.validate_doctor_patient_access': lambda patient_id, pool, current_doctor: mock_get_current_doctor
    }
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Make request with mock token
        response = await client.get(
            f"/patients/{sample_patient_id}",
            headers={"Authorization": f"Bearer {mock_doctor_token}"}
        )
        
        # Check response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Check returned patient data
        patient = data["patient"]
        assert patient["id"] == str(sample_patient_id)
        assert patient["first_name"] == "John"
        assert patient["last_name"] == "Doe"

@pytest.mark.asyncio
async def test_create_medical_record(test_db_pool, mock_get_current_doctor):
    # Mock dependencies
    app.dependency_overrides = {
        'app.dependencies.get_db_pool': lambda: test_db_pool,
        'app.dependencies.get_current_doctor': lambda: mock_get_current_doctor,
        'app.dependencies.validate_doctor_patient_access': lambda patient_id, pool, current_doctor: mock_get_current_doctor
    }
    
    # Mock WebSocket manager broadcast
    with patch('app.websocket.manager.broadcast_to_role', new_callable=AsyncMock) as mock_broadcast:
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Prepare test data
            medical_record_data = {
                "diagnosis": "Common Cold",
                "treatment": "Rest and fluids",
                "notes": "Patient presented with mild symptoms",
                "medications": ["Paracetamol", "Vitamin C"],
                "vital_signs": {
                    "blood_pressure": "120/80",
                    "heart_rate": 72,
                    "temperature": 37.2
                },
                "follow_up_date": "2023-06-15"
            }
            
            # Make request with mock token
            response = await client.post(
                f"/patients/{sample_patient_id}/medical-record",
                headers={"Authorization": f"Bearer {mock_doctor_token}"},
                json=medical_record_data
            )
            
            # Check response
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "record" in data
            
            # Check record data
            record = data["record"]
            assert record["patient_id"] == str(sample_patient_id)
            assert record["doctor_id"] == str(sample_doctor_id)
            assert record["diagnosis"] == medical_record_data["diagnosis"]
            
            # Verify that notification was sent
            mock_broadcast.assert_called_once()

# Clean up overrides after tests
def teardown_module(module):
    app.dependency_overrides = {}
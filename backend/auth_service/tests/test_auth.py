"""Tests for authentication endpoints."""
import pytest
import asyncio
import os
import sys
import uuid
from httpx import AsyncClient
from fastapi import status

# Add parent directory to path to import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.security import get_password_hash
from app.database import init_db, close_db

# Test user data
TEST_USER = {
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass123",
    "full_name": "Test User",
    "role": "doctor"
}

@pytest.fixture(scope="module")
def event_loop():
    """Create event loop for tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="module")
async def test_client():
    """Create test client."""
    # Initialize database
    await init_db()
    
    # Create test client
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    
    # Close database
    await close_db()

@pytest.mark.asyncio
async def test_health_check(test_client):
    """Test health check endpoint."""
    response = await test_client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "healthy", "service": "auth_service"}

@pytest.mark.asyncio
async def test_register_user(test_client):
    """Test user registration."""
    # Delete test user if exists
    from app.database import get_db_pool
    pool = get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM users WHERE email = $1 OR username = $2",
            TEST_USER["email"], TEST_USER["username"]
        )
    
    # Register user
    response = await test_client.post("/auth/register", json=TEST_USER)
    assert response.status_code == status.HTTP_201_CREATED
    
    data = response.json()
    assert data["email"] == TEST_USER["email"]
    assert data["username"] == TEST_USER["username"]
    assert data["full_name"] == TEST_USER["full_name"]
    assert data["role"] == TEST_USER["role"]
    assert "id" in data

@pytest.mark.asyncio
async def test_register_duplicate_email(test_client):
    """Test registering with duplicate email."""
    # Try to register with same email
    duplicate_user = TEST_USER.copy()
    duplicate_user["username"] = "another_user"
    
    response = await test_client.post("/auth/register", json=duplicate_user)
    assert response.status_code == status.HTTP_409_CONFLICT
    assert "Email already exists" in response.json()["detail"]

@pytest.mark.asyncio
async def test_register_duplicate_username(test_client):
    """Test registering with duplicate username."""
    # Try to register with same username
    duplicate_user = TEST_USER.copy()
    duplicate_user["email"] = "another@example.com"
    
    response = await test_client.post("/auth/register", json=duplicate_user)
    assert response.status_code == status.HTTP_409_CONFLICT
    assert "Username already exists" in response.json()["detail"]

@pytest.mark.asyncio
async def test_login(test_client):
    """Test user login."""
    login_data = {
        "username": TEST_USER["username"],
        "password": TEST_USER["password"]
    }
    
    response = await test_client.post("/auth/login", json=login_data)
    assert response.status_code == status.HTTP_200_OK
    
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == TEST_USER["role"]
    
    # Store tokens for later tests
    global access_token, refresh_token
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

@pytest.mark.asyncio
async def test_login_with_email(test_client):
    """Test login with email instead of username."""
    login_data = {
        "username": TEST_USER["email"],  # Using email as username
        "password": TEST_USER["password"]
    }
    
    response = await test_client.post("/auth/login", json=login_data)
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.json()

@pytest.mark.asyncio
async def test_login_invalid_credentials(test_client):
    """Test login with invalid credentials."""
    login_data = {
        "username": TEST_USER["username"],
        "password": "WrongPassword123"
    }
    
    response = await test_client.post("/auth/login", json=login_data)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.asyncio
async def test_get_current_user(test_client):
    """Test getting current user profile."""
    response = await test_client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert response.status_code == status.HTTP_200_OK
    
    data = response.json()
    assert data["email"] == TEST_USER["email"]
    assert data["username"] == TEST_USER["username"]

@pytest.mark.asyncio
async def test_refresh_token(test_client):
    """Test refreshing access token."""
    response = await test_client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert response.status_code == status.HTTP_200_OK
    
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    
    # Update tokens
    global access_token, refresh_token
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

@pytest.mark.asyncio
async def test_invalid_refresh_token(test_client):
    """Test refreshing with invalid token."""
    response = await test_client.post(
        "/auth/refresh",
        json={"refresh_token": "invalid-token"}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.asyncio
async def test_password_reset_request(test_client):
    """Test password reset request."""
    response = await test_client.post(
        "/auth/password-reset/request",
        json={"email": TEST_USER["email"]}
    )
    assert response.status_code == status.HTTP_202_ACCEPTED

@pytest.mark.asyncio
async def test_logout(test_client):
    """Test user logout."""
    response = await test_client.post(
        "/auth/logout",
        json={"refresh_token": refresh_token}
    )
    assert response.status_code == status.HTTP_204_NO_CONTENT
    
    # Try to use the refresh token again
    response = await test_client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
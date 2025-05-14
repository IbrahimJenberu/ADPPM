# app/auth_client.py
import httpx
from fastapi import HTTPException, status

class AuthClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        
    async def get_user(self, user_id: str, token: str) -> dict:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            response = await client.get(
                f"{self.base_url}/api/users/{user_id}",
                headers=headers
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()

# Initialize with your auth service URL
auth_client = AuthClient("http://localhost/8022")  # Replace with actual URL
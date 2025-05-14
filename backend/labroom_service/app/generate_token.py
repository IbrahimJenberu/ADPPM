# generate_token.py
import jwt
from datetime import datetime, timedelta
from app.config import settings

def generate_service_token():
    payload = {
        "service_name": "cardroom_service",
        "role": "service",
        "exp": datetime.utcnow() + timedelta(days=365)  # 1-year validity
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

print("Service Token:", generate_service_token())

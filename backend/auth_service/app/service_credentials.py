# app/service_credentials.py
from .security import get_password_hash

SERVICE_CREDENTIALS = {
    "opd_service": get_password_hash("supersecret123"),
    "labroom_service": get_password_hash("anotherSecret456"),
    "cardroom_service": get_password_hash("yetanotherSecret789")
}

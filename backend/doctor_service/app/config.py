import os
from pydantic import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "ADPPM Doctor Service"
    DEBUG_MODE: bool = os.getenv("DEBUG_MODE", "False").lower() == "true"
    
    # Database settings
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
    DB_NAME: str = os.getenv("DB_NAME", "doctor_service")
    DATABASE_URL: str = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    CARDROOM_SERVICE_URL: str = "http://cardroom_service:8023"
    LAB_SERVICE_URL: str = "http://labroom_service:8025"
    SERVICE_TOKEN: str = "your-service-token"
    
    # Update LAB_SERVICE_URL to include http explicitly
    # LAB_SERVICE_URL: str = os.getenv("LAB_SERVICE_URL", "http://labroom_service:8025")
    
    # Add WebSocket path
    LAB_WS_URL: str = LAB_SERVICE_URL.replace("http", "ws") + "/ws"
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your_secure_secret_key_at_least_32_chars_long")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    SERVICE_TOKEN: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJvcGRfc2VydmljZSIsInJvbGUiOiJzZXJ2aWNlIiwic2VydmljZV9uYW1lIjoib3BkX3NlcnZpY2UiLCJleHAiOjE3NDQxMzkxOTcsImp0aSI6ImE1MWQ2NzVkLWJlZGQtNDg2Zi04NmQ4LTUwMDRiMmRlYTM0MyJ9.QS0PgOp4WZeWO6WpCjZSJvZJNyj4Tr-3z0OoKj4UIEs"
    SERVICE_ID: str = "your_registered_service_id"
    
    # Kafka settings
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    
    # AI model paths
    CHEST_XRAY_MODEL_PATH: str = os.getenv("CHEST_XRAY_MODEL_PATH", "./models/debnset_chest_xray.onnx")
    BRAIN_MRI_MODEL_PATH: str = os.getenv("BRAIN_MRI_MODEL_PATH", "./models/debnset_brain_mri.onnx")
    SYMPTOM_ANALYZER_MODEL_PATH: str = os.getenv("SYMPTOM_ANALYZER_MODEL_PATH", "./models/symptom_analyzer.pkl")
    
    # WebSocket settings
    WS_URL: str = os.getenv("WS_URL", "ws://localhost:8000/ws")
    
    class Config:
        env_file = ".env"

settings = Settings()
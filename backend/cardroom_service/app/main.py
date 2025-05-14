"""
Main application file for the cardroom service.
"""
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db, close_db
from app.exceptions import register_exception_handlers
from app.routers import patients, opd, appointments, search
from app.websocket import websocket_endpoint
# In your main.py or wherever you initialize your FastAPI app
from fastapi.responses import JSONResponse
from app.exceptions import BadRequestException


# Then include your routers and other app setup code
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Startup and shutdown event handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logging.info("Starting up cardroom service...")
    await init_db()
    
    yield
    
    # Shutdown
    logging.info("Shutting down cardroom service...")
    await close_db()

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Card Room Worker service for ADPPM system",
    lifespan=lifespan,
    debug=getattr(settings, 'DEBUG', False),  # Fallback to False if DEBUG doesn't exist
)

# In your main.py or wherever you initialize your FastAPI app
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.exceptions import BadRequestException
import json
from datetime import datetime

# Custom JSON encoder that handles datetime objects
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

app = FastAPI()

@app.exception_handler(BadRequestException)
async def bad_request_exception_handler(request: Request, exc: BadRequestException):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": exc.message,
            "details": exc.details if hasattr(exc, "details") else None
        },
        # Use custom encoder to handle datetime objects
        media_type="application/json"
    )

# In your main.py
from fastapi.encoders import jsonable_encoder
from datetime import datetime

# Override the default jsonable_encoder
def custom_jsonable_encoder(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    return jsonable_encoder(obj)

app.json_encoder = custom_jsonable_encoder
# Register exception handlers
register_exception_handlers(app)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(patients.router, prefix="/api")
app.include_router(opd.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(search.router, prefix="/api")

# WebSocket endpoint
app.websocket("/ws")(websocket_endpoint)

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.APP_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8023,
        reload=settings.DEBUG
    )
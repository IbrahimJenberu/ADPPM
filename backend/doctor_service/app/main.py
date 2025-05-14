# doctor_service/app/main.py
import asyncio
import uuid
import time
import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

import asyncpg

from app.config import settings
from app.dependencies import get_db_pool, get_current_doctor
from app.websocket import manager, get_websocket_user
from app.notifications import get_user_notifications, mark_notification_as_read
from app.exceptions import DatabaseException

from app.routers import (
    patients, appointments, lab_requests, ai_diagnosis,
    medical_reports, notifications, sync, lab_results_ws, inter_service, opd_ws, opd_webhook
)
from app.database import get_app_pool, close_app_pool  # application-level pool

from fastapi import WebSocket, WebSocketDisconnect, Request, status, Path

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("DoctorServiceApp")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    startup_time = time.time()
    logger.info("Doctor Service starting up...")
    yield  # <-- allow FastAPI to start
    # Shutdown logic
    logger.info("Doctor Service shutting down...")

# Create FastAPI app with lifespan manager
app = FastAPI(
    title="Doctor Service API",
    description="API for doctor-related functionalities including AI diagnosis.",
    version="1.0.0",
    lifespan=lifespan
)

# Startup events
@app.on_event("startup")
async def startup_event():
    # Initialize DB pool
    await get_app_pool()
    logger.info("Initialized application-level database pool")
    # Initialize HTTP client in cardroom_service
    from app.services.cardroom_service import http_client
    # Connect WebSocket to labroom service
    from app.utils.lab_request_ws_client import get_ws_connection
    asyncio.create_task(get_ws_connection())
    logger.info("Initializing WebSocket connection to lab service")

# Shutdown events
@app.on_event("shutdown")
async def shutdown_event():
    # Clean up HTTP client
    from app.services.cardroom_service import cleanup
    await cleanup()
    logger.info("Cleaned up HTTP resources")
    # Close DB pool
    await close_app_pool()
    logger.info("Closed application-level database pool")

# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Request validation error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception for {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(notifications.router)
app.include_router(patients.router)
app.include_router(appointments.router)
app.include_router(lab_requests.router)
# AI router included only if loaded; defined inside ai_diagnosis module
app.include_router(medical_reports.router)
app.include_router(lab_results_ws.router)
app.include_router(inter_service.router)
app.include_router(sync.router, prefix="/sync", tags=["sync"])
app.include_router(opd_ws.router)
app.include_router(opd_webhook.router)

# Static files
app.mount("/files", StaticFiles(directory="storage"), name="files")

# Health endpoints
@app.get("/", tags=["Root"], include_in_schema=False)
async def read_root():
    return {"message": "Welcome to the Doctor Service"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "doctor_service"}

# Notifications endpoints
@app.get("/notifications")
async def get_notifications(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    pool = Depends(get_db_pool),
    current_doctor = Depends(get_current_doctor)
):
    try:
        result = await get_user_notifications(
            pool, uuid.UUID(current_doctor["id"]), limit, offset, unread_only
        )
        return {"success": True, "notifications": result["notifications"], "total": result["total"]}
    except Exception as e:
        raise DatabaseException(detail=f"Failed to get notifications: {e}")

@app.post("/notifications/{notification_id}/read")
async def read_notification(
    notification_id: uuid.UUID,
    pool = Depends(get_db_pool),
    current_doctor = Depends(get_current_doctor)
):
    try:
        notification = await mark_notification_as_read(
            pool, notification_id, uuid.UUID(current_doctor["id"])
        )
        if not notification:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        return {"success": True, "message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to mark notification as read: {e}")

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user = await get_websocket_user(websocket)
    if not user or user.get("role") != "doctor":
        await websocket.close(code=1008, reason="Only doctors can connect")
        return
    conn_id = await manager.connect(websocket, user["id"])
    try:
        await websocket.send_text('{"type":"connected","message":"Connected"}')
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f'{{"type":"echo","data":{data}}}')
    except WebSocketDisconnect:
        manager.disconnect(conn_id)
        logger.info(f"Doctor {user['id']} disconnected")

import os
from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse  # Update this line
from fastapi.staticfiles import StaticFiles
from fastapi import WebSocket
import logging
import asyncio
from typing import Dict, Any
from app.routers import lab_requests, history, lab_results, notification_route, sync, analytics, reports, inter_service, websocket_routes
from .config import settings
from .database import init_db, close_db
from .exceptions import LabServiceException
from .security import get_current_user
from .websocket import websocket_endpoint
from app.routers.lab_requests_ws import lab_requests_websocket
from app.ws_routes import lab_requests_websocket

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Lab Room Service API for ADPPM",
    version="1.0.0",
    docs_url="/api/docs",    
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Exception handler for custom exceptions
@app.exception_handler(LabServiceException)
async def lab_service_exception_handler(request: Request, exc: LabServiceException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": exc.detail},
    )

# Update app.include_router section in main.py
app.include_router(lab_requests.router, prefix="/api", tags=["lab_requests"])
app.include_router(history.router, prefix="/api", tags=["history"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])
app.include_router(reports.router, prefix="/api", tags=["reports"])
app.include_router(lab_results.router, prefix="/api", tags=["lab_results"])
app.include_router(websocket_routes.router, prefix="/api", tags=["websocket"])
app.include_router(notification_route.router, prefix="/api", tags=["notifications"])
app.include_router(inter_service.router, prefix="/api", tags=["inter_service"]) 
app.include_router(sync.router, prefix="/sync", tags=["sync"])

@app.websocket("/ws/lab-requests/{doctor_id}")
async def lab_requests_ws_endpoint(websocket: WebSocket, doctor_id: str):
    from app.ws_routes import lab_requests_websocket
    await lab_requests_websocket(websocket, doctor_id)

# Add root endpoint redirect
@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/api/docs")

# In main.py, add these imports at the top
from app.routers.lab_requests import startup_event as lab_requests_startup
from app.routers.lab_results import startup_event as lab_results_startup

# Then modify the existing startup_event function in main.py:
@app.on_event("startup")
async def startup_event():
    await init_db()
    # Initialize modules
    await lab_requests_startup()
    await lab_results_startup()
    logging.info("Database and modules initialized")

# Add WebSocket endpoint
app.add_websocket_route("/ws", websocket_endpoint)

# Startup event
@app.on_event("startup")
async def startup_event():
    await init_db()
    logging.info("Database initialized")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    await close_db()
    logging.info("Database connection closed")

# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "labroom_service"}

# Version endpoint
@app.get("/version", tags=["Health"])
async def version():
    return {"version": "1.0.0", "service": "labroom_service"}

# Protected health check for testing authentication
@app.get("/protected-health", tags=["Health"])
async def protected_health_check(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "status": "healthy", 
        "service": "labroom_service", 
        "user_id": current_user.get("sub"),
        "role": current_user.get("role")
    }  

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8025, reload=True)
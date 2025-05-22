from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db, close_db
from app.exceptions import register_exception_handlers, BadRequestException
from app.routers import patients, opd, appointments, search
from app.websocket import websocket_endpoint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Starting up cardroom service...")
    await init_db()
    yield
    logging.info("Shutting down cardroom service...")
    await close_db()

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Card Room Worker service for ADPPM system",
    lifespan=lifespan,
    debug=getattr(settings, 'DEBUG', False),
)

# Register global exception handlers
register_exception_handlers(app)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(patients.router, prefix="/api")
app.include_router(opd.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(search.router, prefix="/api")

# WebSocket support
app.websocket("/ws")(websocket_endpoint)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}

# Run with uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8023,
        reload=settings.DEBUG
    )

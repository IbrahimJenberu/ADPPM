"""Main FastAPI application module."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from .config import settings
from .database import init_db, close_db
from .routers import auth, users, service_auth
from .routers.analytics import router as analytics_router
from .websocket import router as ws_router
from .analytics.middleware import analytics_middleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("auth_service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Context manager for FastAPI app startup and shutdown events.
    """
    # Startup events
    logger.info("Starting auth service...")
    await init_db()
    yield
    # Shutdown events
    logger.info("Shutting down auth service...")
    await close_db()

# Initialize FastAPI app
app = FastAPI(
    title="ADPPM Authentication Service",
    description="Authentication and Authorization microservice for AI Doctor for Proactive Patient Management",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["User Management"])
app.include_router(service_auth.router, prefix="/service_auth", tags=["service_auth"])
app.include_router(ws_router)
# Add analytics middleware
app.middleware("http")(analytics_middleware)

# Include routers
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(analytics_router)  # Already has prefix="/analytics"

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "auth_service"}
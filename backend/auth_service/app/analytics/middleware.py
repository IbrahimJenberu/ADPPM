"""Analytics middleware for route tracking."""
import time
from contextlib import asynccontextmanager
from fastapi import Request
from typing import Dict, Any

from .models import analytics_store

@asynccontextmanager
async def route_analytics(request: Request):
    """
    Context manager for tracking route analytics.

    Args:
        request: FastAPI request object
        
    Yields:
        None
    """
    # Get start time
    start_time = time.time()
    
    # Extract user ID from request if authenticated
    user_id = None
    if hasattr(request.state, "user") and request.state.user:
        user_id = request.state.user.get("id")
    
    # Extract request data for potential logging
    request_data = None
    if request.method in ["POST", "PUT"]:
        try:
            body = await request.body()
            if body:
                request_data = {"content_type": request.headers.get("content-type")}
                # Don't log actual body content for privacy/security
        except Exception:
            pass
    
    try:
        # Execute the request handler
        yield
    finally:
        # Calculate response time
        response_time = time.time() - start_time
        
        # Get response status code (defaults to 500 if not available)
        status_code = getattr(request.state, "response_status_code", 500)
        
        # Log the request
        analytics_store.log_request(
            route=request.url.path,
            method=request.method,
            user_id=user_id,
            status_code=status_code,
            response_time=response_time,
            request_data=request_data
        )

async def analytics_middleware(request: Request, call_next):
    """
    Middleware to capture request/response data for analytics.
    
    Args:
        request: FastAPI request object
        call_next: Next middleware function
        
    Returns:
        Response object
    """
    # Track start time
    start_time = time.time()
    
    # Get user ID if available
    user_id = None
    if hasattr(request, "state") and hasattr(request.state, "user"):
        user_id = request.state.user.get("id")
    
    # Process the request
    response = await call_next(request)
    
    # Calculate response time
    response_time = time.time() - start_time
    
    # Log the request after it's processed
    analytics_store.log_request(
        route=request.url.path,
        method=request.method,
        user_id=user_id,
        status_code=response.status_code,
        response_time=response_time
    )
    
    return response
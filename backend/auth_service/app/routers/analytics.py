"""Analytics API routes."""
from fastapi import APIRouter, Depends, Query, Path
from typing import Dict, Any, Optional, List
import uuid
from datetime import datetime

from ..dependencies import has_role
from ..analytics.models import analytics_store

# Create router
router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/summary", response_model=Dict[str, Any])
async def get_analytics_summary(
    #current_user: Dict[str, Any] = Depends(has_role(["admin"]))
):
    """
    Get a summary of analytics data (admin only).
    
    Args:
        current_user: Current user dict (admin only)
        
    Returns:
        Analytics summary
    """
    return analytics_store.generate_summary_report()

@router.get("/routes", response_model=Dict[str, Any])
async def get_route_analytics(
    route: Optional[str] = Query(None, description="Specific route to get stats for"),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"]))
):
    """
    Get analytics for routes (admin only).
    
    Args:
        route: Optional specific route to get stats for
        current_user: Current user dict (admin only)
        
    Returns:
        Route analytics
    """
    return analytics_store.get_route_stats(route)

@router.get("/popular", response_model=List[Dict[str, Any]])
async def get_popular_routes(
    limit: int = Query(10, ge=1, le=100),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"]))
):
    """
    Get most popular routes (admin only).
    
    Args:
        limit: Maximum number of routes to return
        current_user: Current user dict (admin only)
        
    Returns:
        List of popular routes
    """
    return analytics_store.get_most_visited_routes(limit)

@router.get("/user/{user_id}", response_model=Dict[str, Any])
async def get_user_analytics(
    user_id: uuid.UUID = Path(...),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"]))
):
    """
    Get analytics for a specific user (admin only).
    
    Args:
        user_id: User ID to get analytics for
        current_user: Current user dict (admin only)
        
    Returns:
        User analytics
    """
    return analytics_store.get_user_activity(str(user_id))

@router.get("/history", response_model=List[Dict[str, Any]])
async def get_analytics_history(
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[uuid.UUID] = Query(None),
    route: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"]))
):
    """
    Get history of route access (admin only).
    
    Args:
        limit: Maximum number of entries to return
        user_id: Filter by user ID
        route: Filter by route path
        start_time: Filter by start time
        end_time: Filter by end time
        current_user: Current user dict (admin only)
        
    Returns:
        History log entries
    """
    return analytics_store.get_history_log(
        limit=limit,
        user_id=str(user_id) if user_id else None,
        route=route,
        start_time=start_time,
        end_time=end_time
    )

@router.get("/time-based/{period}", response_model=Dict[str, Any])
async def get_time_based_analytics(
    period: str = Path(..., regex="^(daily|weekly|monthly)$"),
    #current_user: Dict[str, Any] = Depends(has_role(["admin"]))
):
    """
    Get time-based analytics report (admin only).
    
    Args:
        period: Time period for the report ("daily", "weekly", "monthly")
        current_user: Current user dict (admin only)
        
    Returns:
        Time-based analytics report
    """
    return analytics_store.get_time_based_report(period)

@router.get("/report", response_model=Dict[str, Any])
async def generate_comprehensive_report(
    #current_user: Dict[str, Any] = Depends(has_role(["admin"]))
    admin_id: uuid.UUID = Query(..., description="Admin ID from frontend"),
):
    """
    Generate a comprehensive analytics report (admin only).
    
    Args:
        current_user: Current user dict (admin only)
        
    Returns:
        Comprehensive analytics report
    """
    # Get summary report
    summary = analytics_store.generate_summary_report()
    
    # Get top routes
    top_routes = analytics_store.get_most_visited_routes(10)
    
    # Get daily report
    daily = analytics_store.get_time_based_report("daily")
    
    # Get user activity for the admin user
    admin_activity = analytics_store.get_user_activity(str(admin_id))
    
    return {
        "summary": summary,
        "top_routes": top_routes,
        "daily_stats": daily,
        "admin_activity": admin_activity,
        "generated_at": datetime.utcnow()
    }
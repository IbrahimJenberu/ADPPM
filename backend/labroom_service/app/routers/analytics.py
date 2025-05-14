# app/routes/analytics.py
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from datetime import datetime, date, timedelta
import json

from ..schemas import AnalyticsResponse, AnalyticsMetrics
from ..database import get_connection, fetch_all
from ..models import TestStatus, TestPriority, TestType
from ..exceptions import DatabaseException

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard", response_model=AnalyticsResponse)
async def get_analytics_dashboard(
    from_date: Optional[date] = Query(None, description="Start date for analytics"),
    to_date: Optional[date] = Query(None, description="End date for analytics"),
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    Get real-time analytics for the lab requests dashboard.
    """
    # Set default date range if not provided (last 7 days)
    if not to_date:
        to_date = date.today()
    if not from_date:
        from_date = to_date - timedelta(days=7)
    
    conn = await get_connection()
    
    try:
        # Get total requests today
        today_query = """
            SELECT COUNT(*) FROM lab_requests
            WHERE DATE(created_at) = CURRENT_DATE AND is_deleted = FALSE
        """
        total_today = await conn.fetchval(today_query)
        
        # Get pending vs completed requests
        status_query = """
            SELECT status, COUNT(*) as count FROM lab_requests
            WHERE is_deleted = FALSE
            GROUP BY status
        """
        status_rows = await conn.fetch(status_query)
        status_breakdown = {row["status"]: row["count"] for row in status_rows}
        
        # Calculate metrics
        pending = sum(status_breakdown.get(status, 0) for status in [
            TestStatus.PENDING.value,
            TestStatus.IN_PROGRESS.value
        ])
        completed = status_breakdown.get(TestStatus.COMPLETED.value, 0)
        
        # Get unread requests count
        unread_query = """
            SELECT COUNT(*) FROM lab_requests
            WHERE is_read = FALSE AND is_deleted = FALSE
        """
        unread_count = await conn.fetchval(unread_query)
        
        # Calculate average response time (in hours)
        response_time_query = """
            SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600) as avg_hours
            FROM lab_requests
            WHERE status = $1 AND completed_at IS NOT NULL
            AND created_at IS NOT NULL AND is_deleted = FALSE
        """
        avg_response_time = await conn.fetchval(response_time_query, TestStatus.COMPLETED.value)
        
        # Get daily requests data for the selected time period
        daily_query = """
            SELECT DATE(created_at) as request_date, COUNT(*) as count
            FROM lab_requests
            WHERE created_at BETWEEN $1 AND $2 AND is_deleted = FALSE
            GROUP BY DATE(created_at)
            ORDER BY request_date
        """
        daily_rows = await conn.fetch(daily_query, from_date, to_date + timedelta(days=1))
        daily_data = [{"date": row["request_date"].isoformat(), "count": row["count"]} 
                      for row in daily_rows]
        
        # Get test type breakdown
        test_type_query = """
            SELECT test_type, COUNT(*) as count
            FROM lab_requests
            WHERE created_at BETWEEN $1 AND $2 AND is_deleted = FALSE
            GROUP BY test_type
            ORDER BY count DESC
        """
        test_type_rows = await conn.fetch(test_type_query, from_date, to_date + timedelta(days=1))
        test_type_data = [{"test_type": row["test_type"], "count": row["count"]} 
                          for row in test_type_rows]
        
        # Get priority breakdown
        priority_query = """
            SELECT priority, COUNT(*) as count
            FROM lab_requests
            WHERE is_deleted = FALSE
            GROUP BY priority
        """
        priority_rows = await conn.fetch(priority_query)
        priority_breakdown = {row["priority"]: row["count"] for row in priority_rows}
        
        # Build metrics
        metrics = AnalyticsMetrics(
            total_requests_today=total_today,
            pending_requests=pending,
            completed_requests=completed,
            unread_requests=unread_count,
            average_response_time=avg_response_time or 0
        )
        
        return AnalyticsResponse(
            success=True,
            metrics=metrics,
            status_breakdown=status_breakdown,
            priority_breakdown=priority_breakdown,
            daily_requests=daily_data,
            test_type_breakdown=test_type_data
        )
        
    except Exception as e:
        raise DatabaseException(detail=f"Failed to fetch analytics data: {str(e)}")
    finally:
        await conn.close()
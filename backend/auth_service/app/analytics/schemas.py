"""Pydantic schemas for analytics."""
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

class RouteStats(BaseModel):
    """Route statistics schema."""
    count: int
    avg_response_time: float
    last_accessed: Optional[datetime] = None

class MethodStats(BaseModel):
    """Method statistics schema for each route."""
    GET: Optional[RouteStats] = None
    POST: Optional[RouteStats] = None
    PUT: Optional[RouteStats] = None
    DELETE: Optional[RouteStats] = None

class RouteAnalytics(BaseModel):
    """Analytics schema for routes."""
    route_stats: Dict[str, MethodStats] = Field(default_factory=dict)

class PopularRoute(BaseModel):
    """Popular route schema."""
    route: str
    count: int

class UserActivity(BaseModel):
    """User activity schema."""
    routes: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    total_requests: int = 0

class HistoryLogEntry(BaseModel):
    """History log entry schema."""
    timestamp: datetime
    route: str
    method: str
    user_id: Optional[str] = None
    status_code: int
    response_time: float
    request_data: Optional[Dict[str, Any]] = None

class SummaryReport(BaseModel):
    """Summary report schema."""
    total_requests: int
    requests_24h: int
    avg_response_time: float
    top_routes: List[PopularRoute]
    busiest_hour: Optional[str] = None
    unique_users: int
    report_generated_at: datetime

class TimeBasedReport(BaseModel):
    """Time-based report schema."""
    period_data: Dict[str, Dict[str, int]] = Field(default_factory=dict)

class ComprehensiveReport(BaseModel):
    """Comprehensive analytics report schema."""
    summary: SummaryReport
    top_routes: List[PopularRoute]
    daily_stats: Dict[str, Dict[str, int]] = Field(default_factory=dict)
    admin_activity: UserActivity
    generated_at: datetime
"""Analytics data models."""
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from collections import defaultdict

class AnalyticsStore:
    """
    In-memory storage for route analytics data.
    
    This class provides methods for storing and retrieving analytics data
    about API route usage, including real-time tracking, history logs,
    and report generation capabilities.
    """
    def __init__(self):
        # Route access counter
        self.route_counters = defaultdict(int)
        # Route timing tracker (for calculating average response time)
        self.route_timing = defaultdict(list)
        # User-based route tracking
        self.user_route_access = defaultdict(lambda: defaultdict(int))
        # Historical log of route access (limited capacity circular buffer)
        self.history_log = []
        self.history_max_size = 1000  # Maximum number of history entries to keep
        # Most recent access timestamps per route
        self.last_access = {}
        # Record daily, weekly, monthly stats
        self.daily_stats = defaultdict(lambda: defaultdict(int))
        self.weekly_stats = defaultdict(lambda: defaultdict(int))
        self.monthly_stats = defaultdict(lambda: defaultdict(int))
    
    def log_request(self, 
                   route: str, 
                   method: str, 
                   user_id: Optional[str], 
                   status_code: int,
                   response_time: float,
                   request_data: Optional[Dict] = None):
        """
        Log a single API request with analytics data.
        
        Args:
            route: The endpoint path
            method: HTTP method (GET, POST, etc.)
            user_id: ID of the user making the request (if authenticated)
            status_code: HTTP status code of the response
            response_time: Time taken to process the request (in seconds)
            request_data: Optional data about the request
        """
        timestamp = datetime.utcnow()
        route_key = f"{method}:{route}"
        day_key = timestamp.strftime("%Y-%m-%d")
        week_key = timestamp.strftime("%Y-W%U")
        month_key = timestamp.strftime("%Y-%m")
        
        # Increment route counter
        self.route_counters[route_key] += 1
        
        # Store timing information
        self.route_timing[route_key].append(response_time)
        # Keep only the last 100 timing entries per route
        if len(self.route_timing[route_key]) > 100:
            self.route_timing[route_key].pop(0)
        
        # Update user-specific access if user is authenticated
        if user_id:
            self.user_route_access[user_id][route_key] += 1
        
        # Update last access timestamp
        self.last_access[route_key] = timestamp
        
        # Update time-based stats
        self.daily_stats[day_key][route_key] += 1
        self.weekly_stats[week_key][route_key] += 1
        self.monthly_stats[month_key][route_key] += 1
        
        # Add to history log
        history_entry = {
            "timestamp": timestamp,
            "route": route,
            "method": method,
            "user_id": user_id,
            "status_code": status_code,
            "response_time": response_time,
            "request_data": request_data
        }
        
        self.history_log.append(history_entry)
        
        # Trim history log if it exceeds maximum size
        if len(self.history_log) > self.history_max_size:
            self.history_log.pop(0)
    
    def get_route_stats(self, route: Optional[str] = None) -> Dict:
        """
        Get statistics for all routes or a specific route.
        
        Args:
            route: Optional specific route to get stats for
            
        Returns:
            Dictionary of route statistics
        """
        if route:
            # Stats for a specific route
            route_stats = {}
            for method in ["GET", "POST", "PUT", "DELETE"]:
                route_key = f"{method}:{route}"
                if route_key in self.route_counters:
                    timings = self.route_timing.get(route_key, [])
                    avg_time = sum(timings) / len(timings) if timings else 0
                    
                    route_stats[method] = {
                        "count": self.route_counters[route_key],
                        "avg_response_time": avg_time,
                        "last_accessed": self.last_access.get(route_key)
                    }
            return route_stats
        else:
            # Stats for all routes
            all_stats = {}
            for route_key in self.route_counters:
                method, path = route_key.split(":", 1)
                if path not in all_stats:
                    all_stats[path] = {}
                
                timings = self.route_timing.get(route_key, [])
                avg_time = sum(timings) / len(timings) if timings else 0
                
                all_stats[path][method] = {
                    "count": self.route_counters[route_key],
                    "avg_response_time": avg_time,
                    "last_accessed": self.last_access.get(route_key)
                }
            return all_stats
    
    def get_most_visited_routes(self, limit: int = 10) -> List[Dict]:
        """
        Get the most frequently visited routes.
        
        Args:
            limit: Maximum number of routes to return
            
        Returns:
            List of route statistics, sorted by visit count
        """
        # Aggregate counts by route (combining all methods)
        route_totals = defaultdict(int)
        for route_key, count in self.route_counters.items():
            _, path = route_key.split(":", 1)
            route_totals[path] += count
        
        # Sort and limit
        top_routes = sorted(
            [{"route": route, "count": count} for route, count in route_totals.items()],
            key=lambda x: x["count"],
            reverse=True
        )
        
        return top_routes[:limit]
    
    def get_user_activity(self, user_id: str) -> Dict:
        """
        Get activity statistics for a specific user.
        
        Args:
            user_id: User ID to get stats for
            
        Returns:
            Dictionary of user activity statistics
        """
        if user_id not in self.user_route_access:
            return {"routes": {}, "total_requests": 0}
        
        user_routes = {}
        total_requests = 0
        
        for route_key, count in self.user_route_access[user_id].items():
            method, path = route_key.split(":", 1)
            if path not in user_routes:
                user_routes[path] = {}
            
            user_routes[path][method] = count
            total_requests += count
        
        return {
            "routes": user_routes,
            "total_requests": total_requests
        }
    
    def get_history_log(self, 
                        limit: int = 100, 
                        user_id: Optional[str] = None,
                        route: Optional[str] = None,
                        start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None) -> List[Dict]:
        """
        Get filtered history log entries.
        
        Args:
            limit: Maximum number of entries to return
            user_id: Filter by user ID
            route: Filter by route path
            start_time: Filter by start time
            end_time: Filter by end time
            
        Returns:
            List of history log entries matching filters
        """
        filtered_log = self.history_log
        
        # Apply filters
        if user_id:
            filtered_log = [entry for entry in filtered_log if entry["user_id"] == user_id]
        
        if route:
            filtered_log = [entry for entry in filtered_log if entry["route"] == route]
        
        if start_time:
            filtered_log = [entry for entry in filtered_log if entry["timestamp"] >= start_time]
        
        if end_time:
            filtered_log = [entry for entry in filtered_log if entry["timestamp"] <= end_time]
        
        # Sort by timestamp (newest first) and limit
        sorted_log = sorted(filtered_log, key=lambda x: x["timestamp"], reverse=True)
        
        return sorted_log[:limit]
    
    def get_time_based_report(self, period: str = "daily") -> Dict:
        """
        Get time-based analytics report.
        
        Args:
            period: Time period for the report ("daily", "weekly", "monthly")
            
        Returns:
            Time-based analytics report
        """
        if period == "daily":
            stats = self.daily_stats
            # Get the last 7 days
            days = sorted(list(stats.keys()))[-7:]
            report_data = {day: dict(stats[day]) for day in days}
        elif period == "weekly":
            stats = self.weekly_stats
            # Get the last 4 weeks
            weeks = sorted(list(stats.keys()))[-4:]
            report_data = {week: dict(stats[week]) for week in weeks}
        elif period == "monthly":
            stats = self.monthly_stats
            # Get the last 6 months
            months = sorted(list(stats.keys()))[-6:]
            report_data = {month: dict(stats[month]) for month in months}
        else:
            report_data = {}
        
        return report_data
    
    def generate_summary_report(self) -> Dict:
        """
        Generate a comprehensive summary report of system usage.
        
        Returns:
            Summary report with various analytics metrics
        """
        now = datetime.utcnow()
        
        # Get top routes
        top_routes = self.get_most_visited_routes(5)
        
        # Calculate total requests
        total_requests = sum(self.route_counters.values())
        
        # Calculate average response time across all routes
        all_timings = [time for route_timings in self.route_timing.values() for time in route_timings]
        avg_response_time = sum(all_timings) / len(all_timings) if all_timings else 0
        
        # Get requests in the last 24 hours
        yesterday = now - timedelta(days=1)
        recent_history = [entry for entry in self.history_log if entry["timestamp"] >= yesterday]
        requests_24h = len(recent_history)
        
        # Calculate the busiest hour
        hour_counts = defaultdict(int)
        for entry in recent_history:
            hour = entry["timestamp"].strftime("%H")
            hour_counts[hour] += 1
        
        busiest_hour = max(hour_counts.items(), key=lambda x: x[1], default=(None, 0))
        
        return {
            "total_requests": total_requests,
            "requests_24h": requests_24h,
            "avg_response_time": avg_response_time,
            "top_routes": top_routes,
            "busiest_hour": busiest_hour[0],
            "unique_users": len(self.user_route_access),
            "report_generated_at": now
        }

# Initialize the analytics store (singleton instance)
analytics_store = AnalyticsStore()
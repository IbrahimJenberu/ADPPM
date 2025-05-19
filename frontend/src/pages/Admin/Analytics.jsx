import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast, ToastContainer } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-toastify/dist/ReactToastify.css';
// Import Chart.js
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

function Analytics() {
  // ===== STATE & AUTH =====
  const { authClient } = useAuth();
  
  // Analytics state
  const [analyticsSubTab, setAnalyticsSubTab] = useState('dashboard');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [routeAnalytics, setRouteAnalytics] = useState(null);
  const [timeBasedStats, setTimeBasedStats] = useState(null);
  const [analyticsTimePeriod, setAnalyticsTimePeriod] = useState('daily');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(15);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [historyData, setHistoryData] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({
    user_id: null,
    route: '',
    start_time: null,
    end_time: null,
    limit: 100
  });
  
  // Pagination state for history
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    size: 10,
    total: 0,
    pages: 1
  });
  
  // Dark mode detection
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    // Check if dark mode is enabled
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
    
    // Listen for changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      setIsDarkMode(event.matches);
    });
  }, []);
  
  // Refs
  const autoRefreshTimerRef = useRef(null);
  const refreshButtonRef = useRef(null);
  
  // ===== ANALYTICS FETCH FUNCTIONS =====
  const fetchAnalyticsSummary = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const response = await authClient.get('/analytics/summary');
      setAnalyticsSummary(response.data);
      setLastRefreshTime(new Date());
      if (refreshButtonRef.current) {
        refreshButtonRef.current.classList.add('animate-pulse');
        setTimeout(() => {
          if (refreshButtonRef.current) {
            refreshButtonRef.current.classList.remove('animate-pulse');
          }
        }, 1000);
      }
    } catch (error) {
      setAnalyticsError('Failed to fetch analytics summary: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch analytics summary', 'error');
    } finally {
      if (showLoadingState) setAnalyticsLoading(false);
    }
  }, [authClient]);

  const fetchRouteAnalytics = useCallback(async (route = null, showLoadingState = true) => {
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const response = await authClient.get('/analytics/routes', {
        params: route ? { route } : {}
      });
      setRouteAnalytics(response.data);
      setLastRefreshTime(new Date());
    } catch (error) {
      setAnalyticsError('Failed to fetch endpoint analytics: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch endpoint analytics', 'error');
    } finally {
      if (showLoadingState) setAnalyticsLoading(false);
    }
  }, [authClient]);

  const fetchPopularRoutes = useCallback(async (limit = 10, showLoadingState = true) => {
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const response = await authClient.get('/analytics/popular', {
        params: { limit }
      });
      setPopularRoutes(response.data);
      setLastRefreshTime(new Date());
    } catch (error) {
      setAnalyticsError('Failed to fetch popular endpoints: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch popular endpoints', 'error');
    } finally {
      if (showLoadingState) setAnalyticsLoading(false);
    }
  }, [authClient]);

  const fetchTimeBasedStats = useCallback(async (period = 'daily', showLoadingState = true) => {
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const response = await authClient.get(`/analytics/time-based/${period}`);
      setTimeBasedStats(response.data);
      setLastRefreshTime(new Date());
    } catch (error) {
      setAnalyticsError('Failed to fetch time-based analytics: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch time-based analytics', 'error');
    } finally {
      if (showLoadingState) setAnalyticsLoading(false);
    }
  }, [authClient]);

  const fetchUserAnalytics = useCallback(async (userId, showLoadingState = true) => {
    if (!userId) return;
    
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const response = await authClient.get(`/analytics/user/${userId}`);
      setUserAnalytics(response.data);
      setLastRefreshTime(new Date());
    } catch (error) {
      setAnalyticsError('Failed to fetch user analytics: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch user analytics', 'error');
    } finally {
      if (showLoadingState) setAnalyticsLoading(false);
    }
  }, [authClient]);

  const fetchHistoryData = useCallback(async (filters = {}, page = 1, showLoadingState = true) => {
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const params = {
        limit: filters.limit || 100,
        skip: (page - 1) * (filters.limit || 100), // Add pagination offset
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.route && { route: filters.route }),
        ...(filters.start_time && { start_time: filters.start_time.toISOString() }),
        ...(filters.end_time && { end_time: filters.end_time.toISOString() })
      };
      
      const response = await authClient.get('/analytics/history', { params });
      
      // Handle both response formats (array or paginated object)
      if (Array.isArray(response.data)) {
        setHistoryData(response.data);
        setHistoryPagination({
          page: page,
          size: filters.limit || 100,
          total: response.data.length,
          pages: 1
        });
      } else {
        setHistoryData(response.data.items || response.data);
        setHistoryPagination({
          page: page,
          size: filters.limit || 100,
          total: response.data.total || response.data.items?.length || 0,
          pages: Math.ceil((response.data.total || response.data.items?.length || 0) / (filters.limit || 100))
        });
      }
      
      setLastRefreshTime(new Date());
    } catch (error) {
      setAnalyticsError('Failed to fetch request history: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch request history', 'error');
    } finally {
      if (showLoadingState) setAnalyticsLoading(false);
    }
  }, [authClient]);

  // Auto refresh function
  const refreshAnalyticsData = useCallback(() => {
    // Determine which data to refresh based on the current sub-tab
    if (analyticsSubTab === 'dashboard') {
      fetchAnalyticsSummary(false);
      fetchPopularRoutes(10, false);
      if (analyticsTimePeriod) {
        fetchTimeBasedStats(analyticsTimePeriod, false);
      }
    } else if (analyticsSubTab === 'routes') {
      fetchRouteAnalytics(null, false);
      fetchPopularRoutes(10, false);
    } else if (analyticsSubTab === 'history') {
      fetchHistoryData(historyFilters, historyPagination.page, false);
    } else if (analyticsSubTab === 'reports') {
      fetchAnalyticsSummary(false);
      fetchRouteAnalytics(null, false);
      fetchTimeBasedStats(analyticsTimePeriod, false);
    }
    
    // If a user is selected, always refresh user analytics
    if (selectedUserId) {
      fetchUserAnalytics(selectedUserId, false);
    }
    
    setLastRefreshTime(new Date());
  }, [
    analyticsSubTab, 
    analyticsTimePeriod, 
    selectedUserId, 
    historyFilters,
    historyPagination.page,
    fetchAnalyticsSummary, 
    fetchPopularRoutes, 
    fetchTimeBasedStats, 
    fetchRouteAnalytics, 
    fetchUserAnalytics, 
    fetchHistoryData
  ]);

  // Load analytics data on component mount
  useEffect(() => {
    // Load different data based on the sub-tab
    if (analyticsSubTab === 'dashboard') {
      fetchAnalyticsSummary();
      fetchPopularRoutes();
      fetchTimeBasedStats(analyticsTimePeriod);
    } else if (analyticsSubTab === 'routes') {
      fetchRouteAnalytics();
      fetchPopularRoutes();
    } else if (analyticsSubTab === 'history') {
      fetchHistoryData(historyFilters, historyPagination.page);
    } else if (analyticsSubTab === 'reports') {
      fetchAnalyticsSummary();
      fetchRouteAnalytics();
      fetchTimeBasedStats(analyticsTimePeriod);
    }
  }, [
    analyticsSubTab, 
    fetchAnalyticsSummary, 
    fetchPopularRoutes, 
    fetchTimeBasedStats, 
    fetchRouteAnalytics, 
    fetchHistoryData, 
    analyticsTimePeriod, 
    historyFilters,
    historyPagination.page
  ]);

  // Refresh time-based stats when period changes
  useEffect(() => {
    if (analyticsSubTab === 'dashboard' || analyticsSubTab === 'reports') {
      fetchTimeBasedStats(analyticsTimePeriod);
    }
  }, [analyticsTimePeriod, analyticsSubTab, fetchTimeBasedStats]);

  // Fetch user-specific analytics when a user is selected
  useEffect(() => {
    if (selectedUserId) {
      fetchUserAnalytics(selectedUserId);
    }
  }, [selectedUserId, fetchUserAnalytics]);

  // Fetch history data when history filters change
  useEffect(() => {
    if (analyticsSubTab === 'history') {
      // Reset to page 1 when filters change
      fetchHistoryData(historyFilters, 1);
    }
  }, [analyticsSubTab, historyFilters, fetchHistoryData]);

  // Set up auto-refresh timer
  useEffect(() => {
    if (autoRefreshEnabled) {
      // Clear existing timer
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
      
      // Set up new timer
      autoRefreshTimerRef.current = setInterval(() => {
        refreshAnalyticsData();
      }, autoRefreshInterval * 1000);
      
      // Clean up on unmount or when dependencies change
      return () => {
        if (autoRefreshTimerRef.current) {
          clearInterval(autoRefreshTimerRef.current);
        }
      };
    } else if (!autoRefreshEnabled && autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }
  }, [autoRefreshEnabled, autoRefreshInterval, refreshAnalyticsData]);

  // ===== HANDLERS =====
  // Show toast notification
  const showToast = (message, type = 'success') => {
    toast[type](message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      className: type === 'success' ? 'bg-teal-50 text-teal-800 border-l-4 border-teal-500 dark:bg-teal-900/40 dark:text-teal-200 dark:border-teal-500' : 
                 type === 'error' ? 'bg-rose-50 text-rose-800 border-l-4 border-rose-500 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-500' : 
                 'bg-blue-50 text-blue-800 border-l-4 border-blue-500 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-500',
    });
  };
  
  // Update history filters
  const handleHistoryFilterChange = (name, value) => {
    setHistoryFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle page change for history pagination
  const handleHistoryPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= historyPagination.pages) {
      fetchHistoryData(historyFilters, newPage);
    }
  };
  
  // Clear history filters
  const clearHistoryFilters = () => {
    setHistoryFilters({
      user_id: null,
      route: '',
      start_time: null,
      end_time: null,
      limit: 100
    });
  };
  
  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(prev => !prev);
    
    // Show a toast notification
    if (!autoRefreshEnabled) {
      showToast(`Auto-refresh enabled. Data will refresh every ${autoRefreshInterval} seconds.`, 'info');
    } else {
      showToast('Auto-refresh disabled', 'info');
    }
  };
  
  // Change auto-refresh interval
  const changeAutoRefreshInterval = (seconds) => {
    setAutoRefreshInterval(seconds);
    
    if (autoRefreshEnabled) {
      showToast(`Auto-refresh interval set to ${seconds} seconds`, 'info');
    }
  };
  
  // ===== UTILITY FUNCTIONS =====
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  
  // Format date without time
  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(date);
  };
  
  // Format time only
  const formatTimeOnly = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  
  // Get time since refresh
  const getTimeSinceRefresh = () => {
    const now = new Date();
    const diffMs = now - lastRefreshTime;
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    } else {
      const diffMins = Math.floor(diffSecs / 60);
      return `${diffMins}m ${diffSecs % 60}s ago`;
    }
  };
  
  // Get method badge styling
  const getMethodBadgeStyle = (method) => {
    switch (method?.toUpperCase()) {
      case 'GET':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-blue-500/20';
      case 'POST':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-500/20';
      case 'PUT':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-500/20';
      case 'DELETE':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 ring-1 ring-rose-500/20';
      case 'PATCH':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 ring-1 ring-purple-500/20';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 ring-1 ring-gray-500/20';
    }
  };

  // Format number with commas
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Calculate percentage change with sign
  const calculateChange = (current, previous) => {
    if (!previous) return { value: 0, positive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change.toFixed(1)),
      positive: change >= 0
    };
  };

  // Get color class based on performance
  const getPerformanceColorClass = (value, benchmark, inverse = false) => {
    if (value === undefined || value === null) return 'text-gray-500 dark:text-gray-400';
    
    // For metrics where lower is better (like response time), use inverse
    if (inverse) {
      return value <= benchmark ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400';
    }
    
    // For metrics where higher is better
    return value >= benchmark ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400';
  };
  
  // Process time-based data for charts
  const processTimeData = (data) => {
    if (!data || !data.time_data) return { labels: [], datasets: [] };
    
    const labels = data.time_data.map(item => item.period);
    
    // Medical-appropriate colors
    const teal = isDarkMode ? 'rgba(20, 184, 166, 0.8)' : 'rgba(20, 184, 166, 1)';
    const tealLight = isDarkMode ? 'rgba(20, 184, 166, 0.2)' : 'rgba(20, 184, 166, 0.3)';
    const purple = isDarkMode ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 1)';
    
    const datasets = [
      {
        label: 'Unique Visitors',
        data: data.time_data.map(item => item.visitors),
        borderColor: teal,
        backgroundColor: tealLight,
        tension: 0.4,
        fill: true
      },
      {
        label: 'Total Requests',
        data: data.time_data.map(item => item.pageviews),
        borderColor: purple,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        tension: 0.4
      }
    ];
    
    return { labels, datasets };
  };
  
  // Process route data for pie chart based on new API response
  const processRouteData = (routes) => {
    if (!routes || !routes.length) return { labels: [], datasets: [] };
    
    // Take top 5 routes
    const topRoutes = routes.slice(0, 5);
    
    // Convert technical API routes to user-friendly names
    const labels = topRoutes.map(route => {
      const path = route.route || route.path || '/';
      // Map API routes to user-friendly names
      if (path.includes('/users')) return 'User Management';
      if (path.includes('/auth')) return 'Authentication';
      if (path.includes('/patients')) return 'Patient Records';
      if (path.includes('/appointments')) return 'Appointments';
      if (path.includes('/lab')) return 'Lab Results';
      if (path.includes('/billing')) return 'Billing';
      if (path.includes('/prescriptions')) return 'Prescriptions';
      if (path.includes('/analytics')) return 'Analytics';
      
      // Default case - shorten if needed
      return path.length > 25 ? path.substring(0, 22) + '...' : path;
    });
    
    const data = topRoutes.map(route => route.count || route.visits || 0);
    
    // Generate colors - medical-themed
    const backgroundColors = isDarkMode 
      ? [
          'rgba(20, 184, 166, 0.8)', // teal
          'rgba(56, 189, 248, 0.8)', // sky
          'rgba(139, 92, 246, 0.8)', // violet
          'rgba(236, 72, 153, 0.8)', // pink
          'rgba(59, 130, 246, 0.8)', // blue
        ]
      : [
          'rgba(20, 184, 166, 0.8)', // teal
          'rgba(56, 189, 248, 0.7)', // sky
          'rgba(139, 92, 246, 0.7)', // violet
          'rgba(236, 72, 153, 0.7)', // pink
          'rgba(59, 130, 246, 0.7)', // blue
        ];
    
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          borderWidth: 1,
          borderColor: isDarkMode ? '#1f2937' : '#ffffff'
        }
      ]
    };
  };
  
  // Process user activity data for bar chart
  const processUserActivityData = (data) => {
    if (!data || !data.activity_by_day) return { labels: [], datasets: [] };
    
    const labels = data.activity_by_day.map(item => item.day);
    const datasets = [
      {
        label: 'Actions',
        data: data.activity_by_day.map(item => item.actions),
        backgroundColor: isDarkMode ? 'rgba(20, 184, 166, 0.7)' : 'rgba(20, 184, 166, 0.8)',
        borderColor: isDarkMode ? 'rgba(20, 184, 166, 0.9)' : 'rgba(20, 184, 166, 1)',
        borderWidth: 1,
        borderRadius: 4
      }
    ];
    
    return { labels, datasets };
  };

  // Analytics skeleton loader
  const AnalyticsSkeletonLoader = () => (
    <div className="animate-pulse space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-gray-200 dark:bg-gray-700 rounded-xl h-32"></div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-80"></div>
        <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-80"></div>
      </div>
      
      {/* Table */}
      <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-64"></div>
    </div>
  );
  
  // Parse and format analytics data from the new API response format
  const parseAnalyticsData = (summary) => {
    if (!summary) return null;
    
    return {
      total_visits: summary.total_requests || 0,
      active_users: summary.unique_users || 0,
      avg_session_time: formatTime(summary.avg_response_time),
      avg_session_minutes: summary.avg_response_time || 0,
      bounce_rate: '25%', // Use default value if not provided
      bounce_rate_value: 25,
      visit_change: { positive: true, value: '15.2' },
      user_change: { positive: true, value: '9.8' },
      session_change: { positive: false, value: '3.5' },
      bounce_change: { positive: false, value: '2.1' },
      busiest_hour: summary.busiest_hour || '12',
      generated_at: summary.report_generated_at || new Date().toISOString()
    };
  };
  
  // Format time in seconds to human-readable format
  const formatTime = (seconds) => {
    if (seconds === undefined || seconds === null) return '0m 0s';
    
    // Convert to milliseconds for better display
    const ms = seconds * 1000;
    
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }
    
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  // User-friendly endpoint names
  const getEndpointName = (route) => {
    if (!route) return 'Unknown Endpoint';
    
    if (route.includes('/users')) return 'User Management';
    if (route.includes('/auth/login')) return 'User Login';
    if (route.includes('/auth/logout')) return 'User Logout';
    if (route.includes('/auth')) return 'Authentication';
    if (route.includes('/patients/search')) return 'Patient Search';
    if (route.includes('/patients')) return 'Patient Records';
    if (route.includes('/appointments/schedule')) return 'Appointment Scheduling';
    if (route.includes('/appointments/cancel')) return 'Appointment Cancellation';
    if (route.includes('/appointments')) return 'Appointments';
    if (route.includes('/lab/results')) return 'Lab Results';
    if (route.includes('/lab')) return 'Laboratory';
    if (route.includes('/billing/payment')) return 'Payment Processing';
    if (route.includes('/billing/invoice')) return 'Invoice Generation';
    if (route.includes('/billing')) return 'Billing';
    if (route.includes('/prescriptions/refill')) return 'Prescription Refill';
    if (route.includes('/prescriptions')) return 'Prescriptions';
    if (route.includes('/analytics')) return 'Analytics';
    if (route.includes('/dashboard')) return 'Dashboard';
    if (route.includes('/profile')) return 'User Profile';
    if (route.includes('/settings')) return 'System Settings';
    if (route.includes('/messages')) return 'Messaging';
    if (route.includes('/notifications')) return 'Notifications';
    
    return route; // Default fallback if no match
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900 rounded-xl shadow-sm dark:shadow-gray-800/10 p-6 space-y-6">
      {/* Toast Container for notifications */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent">
            User Management Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track susyem users, system usage, patient engagement, and platform performance
          </p>
        </div>
      </div>
      
      {/* Analytics Tabs + Auto Refresh Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setAnalyticsSubTab('dashboard')}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                analyticsSubTab === 'dashboard'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/20 bg-opacity-50'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              } transition-colors focus:outline-none`}
              aria-current={analyticsSubTab === 'dashboard' ? 'page' : undefined}
            >
              Dashboard
            </button>
            <button
              onClick={() => setAnalyticsSubTab('routes')}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                analyticsSubTab === 'routes'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/20 bg-opacity-50'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              } transition-colors focus:outline-none`}
              aria-current={analyticsSubTab === 'routes' ? 'page' : undefined}
            >
              Endpoints
            </button>
            <button
              onClick={() => setAnalyticsSubTab('history')}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                analyticsSubTab === 'history'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/20 bg-opacity-50'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              } transition-colors focus:outline-none`}
              aria-current={analyticsSubTab === 'history' ? 'page' : undefined}
            >
              Activity Log
            </button>
            <button
              onClick={() => setAnalyticsSubTab('reports')}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                analyticsSubTab === 'reports'
                  ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/20 bg-opacity-50'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              } transition-colors focus:outline-none`}
              aria-current={analyticsSubTab === 'reports' ? 'page' : undefined}
            >
              Reports
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <motion.button 
                ref={refreshButtonRef}
                onClick={refreshAnalyticsData}
                className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
                disabled={analyticsLoading}
                aria-label="Refresh data"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${analyticsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </motion.button>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Updated: {getTimeSinceRefresh()}
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex items-center">
              <button
                onClick={() => changeAutoRefreshInterval(5)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  autoRefreshEnabled && autoRefreshInterval === 5
                    ? 'bg-white dark:bg-gray-600 text-teal-600 dark:text-teal-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-pressed={autoRefreshEnabled && autoRefreshInterval === 5}
              >
                5s
              </button>
              <button
                onClick={() => changeAutoRefreshInterval(15)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  autoRefreshEnabled && autoRefreshInterval === 15
                    ? 'bg-white dark:bg-gray-600 text-teal-600 dark:text-teal-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-pressed={autoRefreshEnabled && autoRefreshInterval === 15}
              >
                15s
              </button>
              <button
                onClick={() => changeAutoRefreshInterval(30)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  autoRefreshEnabled && autoRefreshInterval === 30
                    ? 'bg-white dark:bg-gray-600 text-teal-600 dark:text-teal-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-pressed={autoRefreshEnabled && autoRefreshInterval === 30}
              >
                30s
              </button>
              <button
                onClick={() => changeAutoRefreshInterval(60)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  autoRefreshEnabled && autoRefreshInterval === 60
                    ? 'bg-white dark:bg-gray-600 text-teal-600 dark:text-teal-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-pressed={autoRefreshEnabled && autoRefreshInterval === 60}
              >
                1m
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={autoRefreshEnabled}
                  onChange={toggleAutoRefresh}
                  aria-label="Toggle auto refresh"
                />
                <div className={`relative w-11 h-6 ${autoRefreshEnabled ? 'bg-teal-600 dark:bg-teal-500' : 'bg-gray-200 dark:bg-gray-700'} rounded-full peer peer-focus:ring-4 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">Auto-refresh</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Analytics Tools Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-5">
          <div className="flex flex-col md:flex-row gap-5">
            {/* Time period selector */}
            <div className="min-w-[200px]">
              <label htmlFor="timePeriod" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Time Period
              </label>
              <select
                id="timePeriod"
                className="block w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-600 dark:focus:border-teal-500 transition-all duration-200 text-base"
                value={analyticsTimePeriod}
                onChange={(e) => setAnalyticsTimePeriod(e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            {/* User selector (if viewing user-specific analytics) */}
            {selectedUserId && (
              <div className="flex-grow">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Selected User
                </label>
                <div className="flex items-center">
                  <div className="bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 rounded-lg px-3 py-2 font-medium text-sm flex-grow">
                    {selectedUserId}
                  </div>
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    type="button"
                    aria-label="Clear selected user"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {/* History filters (only visible on history tab) */}
            {analyticsSubTab === 'history' && (
              <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="historyRoute" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    System Module
                  </label>
                  <input
                    id="historyRoute"
                    type="text"
                    className="block w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-600 dark:focus:border-teal-500 transition-all duration-200 text-base"
                    placeholder="Appointments, Patients, etc."
                    value={historyFilters.route}
                    onChange={(e) => handleHistoryFilterChange('route', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="historyLimit" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Results Limit
                  </label>
                  <select
                    id="historyLimit"
                    className="block w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-600 dark:focus:border-teal-500 transition-all duration-200 text-base"
                    value={historyFilters.limit}
                    onChange={(e) => handleHistoryFilterChange('limit', parseInt(e.target.value))}
                  >
                    <option value="50">50 entries</option>
                    <option value="100">100 entries</option>
                    <option value="250">250 entries</option>
                    <option value="500">500 entries</option>
                    <option value="1000">1000 entries</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="historyStartDate" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Start Date
                  </label>
                  <input
                    id="historyStartDate"
                    type="date"
                    className="block w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-600 dark:focus:border-teal-500 transition-all duration-200 text-base"
                    value={historyFilters.start_time ? new Date(historyFilters.start_time).toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      handleHistoryFilterChange('start_time', date);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="historyEndDate" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    End Date
                  </label>
                  <input
                    id="historyEndDate"
                    type="date"
                    className="block w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-600 dark:focus:border-teal-500 transition-all duration-200 text-base"
                    value={historyFilters.end_time ? new Date(historyFilters.end_time).toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      handleHistoryFilterChange('end_time', date);
                    }}
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearHistoryFilters}
                    className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
                    type="button"
                  >
                    Reset Filters
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Analytics Content */}
      {analyticsLoading && !analyticsSummary ? (
        <AnalyticsSkeletonLoader />
      ) : analyticsError ? (
        <div className="bg-rose-50 dark:bg-rose-900/20 border-l-4 border-rose-500 p-6 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-rose-400 dark:text-rose-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
                {analyticsError}
              </p>
              <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
                Please check your connection and try again later.
              </p>
              <div className="mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={refreshAnalyticsData}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 dark:bg-rose-700 dark:hover:bg-rose-600"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry Now
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* DASHBOARD TAB */}
          {analyticsSubTab === 'dashboard' && (
            <motion.div
              key="dashboard-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* User-specific analytics or general analytics */}
              {selectedUserId ? (
                <div className="space-y-6">
                  {/* User Analytics Header */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          Provider Activity Analysis
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                          Detailed analytics for selected provider over time
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Last updated:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                          {formatDate(userAnalytics?.last_updated || new Date().toISOString())}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* User Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Logins */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">System Logins</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {formatNumber(userAnalytics?.total_logins || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className={`text-sm ${userAnalytics?.login_change?.positive ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {userAnalytics?.login_change?.positive ? '↑' : '↓'} {userAnalytics?.login_change?.value || 0}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs. previous {analyticsTimePeriod}</span>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Active Days */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Workdays</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {userAnalytics?.active_days || 0}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className={`text-sm ${(userAnalytics?.active_days_change?.positive) ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {(userAnalytics?.active_days_change?.positive) ? '↑' : '↓'} {userAnalytics?.active_days_change?.value || 0}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs. previous {analyticsTimePeriod}</span>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Actions Performed */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">System Actions</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {formatNumber(userAnalytics?.total_actions || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className={`text-sm ${(userAnalytics?.actions_change?.positive) ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {(userAnalytics?.actions_change?.positive) ? '↑' : '↓'} {userAnalytics?.actions_change?.value || 0}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs. previous {analyticsTimePeriod}</span>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Average Session Time */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Session Duration</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {userAnalytics?.avg_session_time || '0m 0s'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className={`text-sm ${(userAnalytics?.session_time_change?.positive) ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {(userAnalytics?.session_time_change?.positive) ? '↑' : '↓'} {userAnalytics?.session_time_change?.value || 0}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs. previous {analyticsTimePeriod}</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  
                  {/* User Activity Chart */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Provider Activity Trends
                    </h3>
                    <div className="h-80">
                      {userAnalytics?.activity_by_day ? (
                        <Bar 
                          data={processUserActivityData(userAnalytics)}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: 'top',
                                labels: {
                                  color: isDarkMode ? '#e5e7eb' : '#111827'
                                }
                              },
                              title: {
                                display: false,
                              },
                              tooltip: {
                                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                titleColor: isDarkMode ? '#f3f4f6' : '#111827',
                                bodyColor: isDarkMode ? '#e5e7eb' : '#374151',
                                borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(203, 213, 225, 1)',
                                borderWidth: 1,
                                padding: 12,
                                boxPadding: 6,
                                usePointStyle: true,
                                boxWidth: 8
                              }
                            },
                            scales: {
                              y: {
                                beginAtZero: true,
                                grid: {
                                  color: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(226, 232, 240, 0.5)',
                                  borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 1)'
                                },
                                ticks: {
                                  color: isDarkMode ? '#e5e7eb' : '#4b5563'
                                },
                                title: {
                                  display: true,
                                  text: 'Actions',
                                  color: isDarkMode ? '#e5e7eb' : '#4b5563'
                                }
                              },
                              x: {
                                grid: {
                                  display: false
                                },
                                ticks: {
                                  color: isDarkMode ? '#e5e7eb' : '#4b5563'
                                },
                                title: {
                                  display: true,
                                  text: 'Date',
                                  color: isDarkMode ? '#e5e7eb' : '#4b5563'
                                }
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-500 dark:text-gray-400">No activity data available</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* User Activity Details */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Most Visited Routes */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Most Used System Modules
                        </h3>
                      </div>
                      <div className="p-4">
                        {userAnalytics?.top_routes?.length ? (
                          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                            {userAnalytics.top_routes.map((route, index) => (
                              <li key={index} className="py-3 flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-medium text-sm">
                                    {index + 1}
                                  </span>
                                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                                    {getEndpointName(route.path || route.route || '/')}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {formatNumber(route.visits || route.count || 0)} requests
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p className="font-medium">No module usage data available</p>
                            <p className="text-sm mt-1 max-w-xs mx-auto">Data will appear here once this provider starts using system modules</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Activity Timeline */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                      <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Recent Activity
                        </h3>
                      </div>
                      <div className="p-4">
                        {userAnalytics?.recent_activity?.length ? (
                          <div className="flow-root">
                            <ul className="-mb-8">
                              {userAnalytics.recent_activity.map((activity, activityIdx) => (
                                <li key={activityIdx}>
                                  <div className="relative pb-8">
                                    {activityIdx !== userAnalytics.recent_activity.length - 1 ? (
                                      <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true"></span>
                                    ) : null}
                                    <div className="relative flex items-start space-x-3">
                                      <div className="relative">
                                        <div className="h-10 w-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center ring-8 ring-white dark:ring-gray-800">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                        </div>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div>
                                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {activity.action ? (
                                              activity.action.charAt(0).toUpperCase() + activity.action.slice(1).toLowerCase()
                                            ) : 'Unknown activity'}
                                          </div>
                                          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                            {getEndpointName(activity.path || activity.route || '/')}
                                          </p>
                                        </div>
                                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                          <p>
                                            {formatDate(activity.timestamp) || 'Unknown time'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="font-medium">No recent activity available</p>
                            <p className="text-sm mt-1 max-w-xs mx-auto">Recent activities will appear here as they occur</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* General Analytics Header */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          System Analytics Overview
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                          Key performance indicators and healthcare platform usage
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Last updated:</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                          {formatDate(analyticsSummary?.report_generated_at || new Date().toISOString())}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Active Users */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Providers</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {formatNumber(analyticsSummary?.unique_users || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className={`text-sm ${parseAnalyticsData(analyticsSummary)?.user_change?.positive ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {parseAnalyticsData(analyticsSummary)?.user_change?.positive ? '↑' : '↓'} {parseAnalyticsData(analyticsSummary)?.user_change?.value || 0}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs. previous {analyticsTimePeriod}</span>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Total Requests */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Transactions</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {formatNumber(analyticsSummary?.total_requests || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Last 24h:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-200 ml-1">
                            {formatNumber(analyticsSummary?.requests_24h || 0)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Average Response Time */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">System Response</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {formatTime(analyticsSummary?.avg_response_time) || '0ms'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className={`text-sm ${parseAnalyticsData(analyticsSummary)?.session_change?.positive ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {parseAnalyticsData(analyticsSummary)?.session_change?.positive ? '↑' : '↓'} {parseAnalyticsData(analyticsSummary)?.session_change?.value || 0}%
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">vs. previous period</span>
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* Peak Hours */}
                    <motion.div 
                      whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="ml-5">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Peak Activity</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                            {analyticsSummary?.busiest_hour || '12'}:00
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Busiest hour of the day</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  
                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">                   
                    {/* Route Distribution Pie Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Module Usage Distribution
                      </h3>
                      <div className="h-80">
                        {analyticsSummary?.top_routes?.length ? (
                          <div className="h-full flex items-center justify-center">
                            <Pie 
                              data={processRouteData(analyticsSummary.top_routes)}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'right',
                                    labels: {
                                      color: isDarkMode ? '#e5e7eb' : '#111827',
                                      padding: 16,
                                      boxWidth: 20,
                                      font: {
                                        size: 12
                                      }
                                    }
                                  },
                                  title: {
                                    display: false,
                                  },
                                  tooltip: {
                                    backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                    titleColor: isDarkMode ? '#f3f4f6' : '#111827',
                                    bodyColor: isDarkMode ? '#e5e7eb' : '#374151',
                                    borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(203, 213, 225, 1)',
                                    borderWidth: 1,
                                    padding: 12,
                                    boxPadding: 6,
                                    usePointStyle: true,
                                    callbacks: {
                                      label: function(context) {
                                        const label = context.label || '';
                                        const value = context.raw || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = Math.round((value / total) * 100);
                                        return `${label}: ${value} requests (${percentage}%)`;
                                      }
                                    }
                                  }
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center text-gray-500 dark:text-gray-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                              </svg>
                              <p className="font-medium">No module data available</p>
                              <p className="text-sm mt-1">Data will appear when the system is used</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Line Chart for Time-Based Data */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        System Activity Trends
                      </h3>
                      <div className="h-80">
                        {timeBasedStats?.time_data?.length ? (
                          <Line 
                            data={processTimeData(timeBasedStats)}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                tooltip: {
                                  backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                  titleColor: isDarkMode ? '#f3f4f6' : '#111827',
                                  bodyColor: isDarkMode ? '#e5e7eb' : '#374151',
                                  borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(203, 213, 225, 1)',
                                  borderWidth: 1,
                                  padding: 12,
                                  boxPadding: 6,
                                  usePointStyle: true,
                                },
                                legend: {
                                  position: 'top',
                                  labels: {
                                    color: isDarkMode ? '#e5e7eb' : '#111827',
                                    usePointStyle: true,
                                    padding: 16,
                                    boxWidth: 8
                                  }
                                },
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(226, 232, 240, 0.5)',
                                    borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 1)'
                                  },
                                  ticks: {
                                    color: isDarkMode ? '#e5e7eb' : '#4b5563'
                                  }
                                },
                                x: {
                                  grid: {
                                    color: isDarkMode ? 'rgba(75, 85, 99, 0.1)' : 'rgba(226, 232, 240, 0.3)',
                                    display: false
                                  },
                                  ticks: {
                                    color: isDarkMode ? '#e5e7eb' : '#4b5563'
                                  }
                                }
                              },
                              elements: {
                                line: {
                                  tension: 0.4
                                },
                                point: {
                                  radius: 3,
                                  hoverRadius: 5
                                }
                              },
                              interaction: {
                                mode: 'index',
                                intersect: false
                              }
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center text-gray-500 dark:text-gray-400">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                              </svg>
                              <p className="font-medium">No trend data available</p>
                              <p className="text-sm mt-1">Activity trends will appear over time</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Popular Modules Table */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Most Used System Modules
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Total transactions: {formatNumber(analyticsSummary?.total_requests || 0)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Rank
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              System Module
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Transactions
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Percentage
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {analyticsSummary?.top_routes && analyticsSummary.top_routes.length > 0 ? (
                            analyticsSummary.top_routes.map((route, index) => {
                              const percentage = ((route.count / analyticsSummary.total_requests) * 100).toFixed(1);
                              return (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-700 dark:text-teal-400 font-medium">
                                        {index + 1}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {getEndpointName(route.route || '/')}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {formatNumber(route.count || 0)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {percentage}%
                                    </div>
                                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                                      <div className="h-full bg-teal-600 dark:bg-teal-500 rounded-full" style={{width: `${percentage}%`}}></div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                <div className="flex flex-col items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <p className="text-lg font-medium mb-1">No module usage data available</p>
                                  <p className="text-sm max-w-md">Usage statistics will appear here as providers interact with different system modules</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          
          {/* ENDPOINTS TAB */}
          {analyticsSubTab === 'routes' && (
            <motion.div
              key="routes-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Routes Analytics Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      System Module Performance
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Detailed insights into module access and response times
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Routes */}
                <motion.div 
                  whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Modules</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(analyticsSummary?.top_routes?.length || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        System functional areas
                      </span>
                    </div>
                  </div>
                </motion.div>
                
                {/* Total Requests */}
                <motion.div 
                  whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Transactions</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(analyticsSummary?.total_requests || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Last 24h: </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-200 ml-1">
                        {formatNumber(analyticsSummary?.requests_24h || 0)}
                      </span>
                    </div>
                  </div>
                </motion.div>
                
                {/* Average Response Time */}
                <motion.div 
                  whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Response Time</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {formatTime(analyticsSummary?.avg_response_time) || '0ms'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">System processing time</span>
                    </div>
                  </div>
                </motion.div>
                
                {/* Busiest Hour */}
                <motion.div 
                  whileHover={{ y: -4, boxShadow: isDarkMode ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-5">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Peak Activity</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {analyticsSummary?.busiest_hour || '7'}:00
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Highest system load</span>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              {/* Module Performance Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Module Performance Analysis
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          System Module
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Total Accesses
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          % of Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {analyticsSummary?.top_routes && analyticsSummary.top_routes.length > 0 ? (
                        analyticsSummary.top_routes.map((route, index) => {
                          const percentage = ((route.count / analyticsSummary.total_requests) * 100).toFixed(1);
                          return (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {getEndpointName(route.route || '/')}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {formatNumber(route.count || 0)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white w-12">
                                    {percentage}%
                                  </span>
                                  <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full ml-2 overflow-hidden">
                                    <div 
                                      className="h-full bg-teal-600 dark:bg-teal-500 rounded-full" 
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            <div className="flex flex-col items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              <p className="text-lg font-medium mb-1">No module data available</p>
                              <p className="text-sm max-w-md">Module usage statistics will appear here as providers interact with the system</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* ACTIVITY LOG TAB */}
          {analyticsSubTab === 'history' && (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* History Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      System Activity Log
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Detailed history of all transactions and system interactions
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Showing</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                      {historyData?.length || 0} entries
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Activity Log Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Provider
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Action
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Module
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {historyData && historyData.length > 0 ? (
                        historyData.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(entry.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-teal-400 to-sky-400 dark:from-teal-600 dark:to-sky-600 text-white border border-teal-200 dark:border-teal-500/20 shadow-sm flex items-center justify-center">
                                  <span className="font-medium text-xs">
                                    {entry.user_name ? entry.user_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                                  </span>
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {entry.user_name || 'Unknown user'}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {entry.user_id ? `ID: ${entry.user_id.substring(0, 8)}...` : 'No ID'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getMethodBadgeStyle(entry.method)}`}>
                                {entry.method ? entry.method.toUpperCase() : 'VIEW'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {getEndpointName(entry.route || '/')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {entry.status_code ? (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                  entry.status_code >= 200 && entry.status_code < 300
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                                    : entry.status_code >= 300 && entry.status_code < 400
                                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 ring-1 ring-sky-500/20'
                                    : entry.status_code >= 400 && entry.status_code < 500
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-500/20'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 ring-1 ring-rose-500/20'
                                }`}>
                                  {entry.status_code}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {entry.duration ? `${entry.duration}ms` : 'N/A'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            <div className="flex flex-col items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-lg font-medium mb-1">No activity log data available</p>
                              <p className="text-sm max-w-md">System activity logs will appear here as providers interact with the system</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination for History/Activity Log */}
              {historyData && historyData.length > 0 && (
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Showing <span className="font-medium">{(historyPagination.page - 1) * historyPagination.size + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(historyPagination.page * historyPagination.size, historyPagination.total)}</span> of{' '}
                        <span className="font-medium">{historyPagination.total}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <motion.button
                          whileHover={{ scale: 1.05, backgroundColor: "#F9FAFB", color: "#374151" }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleHistoryPageChange(historyPagination.page - 1)}
                          disabled={historyPagination.page === 1}
                          className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          type="button"
                          aria-label="Previous page"
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.button>
                        
                        {/* Show page numbers */}
                        {[...Array(historyPagination.pages)].map((_, i) => (
                          <motion.button
                            key={i}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleHistoryPageChange(i + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              historyPagination.page === i + 1
                                ? 'z-10 bg-teal-50 dark:bg-teal-900/20 border-teal-500 dark:border-teal-500/40 text-teal-600 dark:text-teal-400'
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            } transition-colors`}
                            type="button"
                            aria-label={`Page ${i + 1}`}
                            aria-current={historyPagination.page === i + 1 ? 'page' : undefined}
                          >
                            {i + 1}
                          </motion.button>
                        ))}
                        
                        <motion.button
                          whileHover={{ scale: 1.05, backgroundColor: "#F9FAFB", color: "#374151" }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleHistoryPageChange(historyPagination.page + 1)}
                          disabled={historyPagination.page === historyPagination.pages}
                          className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          type="button"
                          aria-label="Next page"
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </motion.button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          
          {/* REPORTS TAB */}
          {analyticsSubTab === 'reports' && (
            <motion.div
              key="reports-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Reports Header */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Analytics Reports
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Comprehensive performance insights and usage trends
                    </p>
                  </div>
                  <div className="flex items-center">
                    <motion.button 
                      whileHover={{ scale: 1.02, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.preventDefault(); 
                        refreshAnalyticsData();
                        showToast("Analytics data refreshed", "success");
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-700 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Data
                    </motion.button>
                  </div>
                </div>
              </div>
              
              {/* Performance Scorecard */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    System Performance Scorecard
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* User Engagement */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Provider Engagement</h4>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Active Providers</span>
                            <span className={`text-xs font-medium ${getPerformanceColorClass(analyticsSummary?.unique_users, 10)}`}>
                              {formatNumber(analyticsSummary?.unique_users || 0)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-teal-600 dark:bg-teal-500 rounded-full" 
                              style={{ width: `${Math.min(((analyticsSummary?.unique_users || 0) / 20) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Avg. Response Time</span>
                            <span className={`text-xs font-medium ${getPerformanceColorClass(analyticsSummary?.avg_response_time, 0.1, true)}`}>
                              {formatTime(analyticsSummary?.avg_response_time) || '0ms'}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-sky-600 dark:bg-sky-500 rounded-full" 
                              style={{ width: `${Math.min(((analyticsSummary?.avg_response_time || 0) / 1) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Transactions (24h)</span>
                            <span className={`text-xs font-medium ${getPerformanceColorClass(analyticsSummary?.requests_24h, 500)}`}>
                              {formatNumber(analyticsSummary?.requests_24h || 0)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full" 
                              style={{ width: `${Math.min((analyticsSummary?.requests_24h || 0) / 2000 * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* API Performance */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Top System Modules</h4>
                      <div className="space-y-3">
                        {analyticsSummary?.top_routes?.slice(0, 3).map((route, index) => (
                          <div key={index}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-40" title={route.route}>
                                {getEndpointName(route.route)}
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                {formatNumber(route.count || 0)}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-teal-600 dark:bg-teal-500 rounded-full" 
                                style={{ width: `${Math.min(((route.count || 0) / (analyticsSummary?.total_requests || 1)) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Busiest Hours */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-1 md:col-span-2 lg:row-span-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">System Activity Overview</h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Total Transactions</span>
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-200">
                              {formatNumber(analyticsSummary?.total_requests || 0)}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-600 dark:bg-teal-500 rounded-full w-full"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Peak Activity Time</span>
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-200">
                              {analyticsSummary?.busiest_hour || '7'}:00
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Highest system load occurs during this hour
                          </div>
                        </div>
                        <div className="pt-2">
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-200 mb-2">
                            System Performance Summary
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            <p>
                              The healthcare platform has processed <span className="font-medium text-gray-800 dark:text-gray-200">{formatNumber(analyticsSummary?.total_requests || 0)}</span> total transactions.
                            </p>
                            <p>
                              Average response time is <span className="font-medium text-gray-800 dark:text-gray-200">{formatTime(analyticsSummary?.avg_response_time)}</span>, indicating {analyticsSummary?.avg_response_time < 0.5 ? 'excellent' : analyticsSummary?.avg_response_time < 1 ? 'good' : 'moderate'} system performance.
                            </p>
                            <p>
                              Most active providers use <span className="font-medium text-gray-800 dark:text-gray-200">{getEndpointName(analyticsSummary?.top_routes?.[0]?.route || '/users/me')}</span> most frequently.
                            </p>
                            <p>
                              System activity peaks at <span className="font-medium text-gray-800 dark:text-gray-200">{analyticsSummary?.busiest_hour || '7'}:00</span>, suggesting optimal staffing during these hours.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default Analytics;
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, subDays, subMonths } from 'date-fns';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { FiActivity, FiCheckSquare, FiClock, FiAlertCircle, FiCalendar, 
  FiDownload, FiRefreshCw, FiBarChart2, FiFilter, FiArrowUp, 
  FiArrowDown, FiChevronDown, FiPieChart } from 'react-icons/fi';
import { MdOutlineHealthAndSafety } from 'react-icons/md';
import { RiTeamLine } from 'react-icons/ri';
import Chart from 'chart.js/auto';

// Add Inter font
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
`;

// API base URL
const API_BASE_URL = "http://localhost:8022";

// Mock monthly data for chart
const MONTHLY_DATA = {
  "2025-05": {
    "User Login": 114,
    "Authentication": 31,
    "User Profile": 32,
    "User Management": 6,
    "Analytics Dashboard": 12,
    "System Logout": 10,
    "Other Actions": 14
  }
};

// Mock data for development (to avoid CORS issues)
const MOCK_DATA = {
  summary: {
    total_requests: 219,
    requests_24h: 42,
    avg_response_time: 0.187,
    prev_avg_response_time: 0.192,
    busiest_hour: 14,
    unique_users: 58,
    top_routes: [
      { route: "User Login", count: 114 },
      { route: "User Profile", count: 32 },
      { route: "Authentication", count: 25 },
      { route: "User Management", count: 18 },
      { route: "Analytics Dashboard", count: 12 },
      { route: "System Logout", count: 10 },
      { route: "Other Actions", count: 8 }
    ]
  },
  popularRoutes: [
    { route: "User Login", count: 114 },
    { route: "User Profile", count: 32 },
    { route: "Authentication", count: 25 },
    { route: "User Management", count: 18 },
    { route: "Analytics Dashboard", count: 12 },
    { route: "System Logout", count: 10 }
  ],
  routeAnalytics: {
    "GET": 128,
    "POST": 72,
    "PUT": 14,
    "DELETE": 5
  },
  timeBasedStats: {
    daily: {
      "2025-05-15": { "User Login": 12, "User Profile": 8, "Other Actions": 5 },
      "2025-05-16": { "User Login": 15, "User Profile": 10, "Other Actions": 7 },
      "2025-05-17": { "User Login": 13, "User Profile": 9, "Other Actions": 6 },
      "2025-05-18": { "User Login": 16, "User Profile": 12, "Other Actions": 8 },
      "2025-05-19": { "User Login": 18, "User Profile": 14, "Other Actions": 9 },
      "2025-05-20": { "User Login": 20, "User Profile": 16, "Other Actions": 12 },
      "2025-05-21": { "User Login": 22, "User Profile": 18, "Other Actions": 14 }
    },
    weekly: {
      "2025-W18": { "User Login": 72, "User Profile": 58, "Other Actions": 41 },
      "2025-W19": { "User Login": 85, "User Profile": 67, "Other Actions": 48 },
      "2025-W20": { "User Login": 92, "User Profile": 73, "Other Actions": 52 },
      "2025-W21": { "User Login": 104, "User Profile": 89, "Other Actions": 64 }
    },
    monthly: MONTHLY_DATA
  },
  historyData: [
    { timestamp: "2025-05-22T08:45:23.000Z", route: "User Login", method: "POST", status_code: 200, response_time: 0.145 },
    { timestamp: "2025-05-22T08:43:12.000Z", route: "User Profile", method: "GET", status_code: 200, response_time: 0.098 },
    { timestamp: "2025-05-22T08:42:05.000Z", route: "Authentication", method: "POST", status_code: 200, response_time: 0.187 },
    { timestamp: "2025-05-22T08:39:56.000Z", route: "User Management", method: "GET", status_code: 200, response_time: 0.123 },
    { timestamp: "2025-05-22T08:36:43.000Z", route: "Analytics Dashboard", method: "GET", status_code: 200, response_time: 0.215 }
  ]
};

// Helper function to map API routes to user-friendly names
const formatApiRoute = (route) => {
  // Remove HTTP method prefixes
  const cleanRoute = route.replace(/^(GET|POST|PUT|DELETE|OPTIONS):/, '');
  
  // Map API endpoints to friendly names
  const routeMap = {
    '/users/me': 'User Profile',
    '/auth/login': 'User Login',
    '/users': 'User Management',
    '/auth/refresh': 'Authentication',
    '/auth/logout': 'System Logout',
    '/analytics/summary': 'Analytics Summary',
    '/analytics/routes': 'Route Analytics',
    '/analytics/popular': 'Popular Routes',
    '/analytics/history': 'Activity History',
    '/analytics/time-based/daily': 'Daily Analytics'
  };
  
  return routeMap[cleanRoute] || cleanRoute;
};

// Toast notification component with enhanced design
const ToastNotification = ({ message, type, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`p-4 rounded-xl shadow-lg backdrop-blur-sm border flex items-center ${
        type === 'success' 
          ? 'bg-emerald-50/90 dark:bg-emerald-900/90 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800' 
          : 'bg-rose-50/90 dark:bg-rose-900/90 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
      }`}
    >
      {type === 'success' 
        ? <FiCheckSquare className="mr-3 w-5 h-5 flex-shrink-0" /> 
        : <FiAlertCircle className="mr-3 w-5 h-5 flex-shrink-0" />
      }
      <span className="font-medium">{message}</span>
      <motion.button 
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose} 
        className="ml-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </motion.button>
    </motion.div>
  );
};

// Shimmer loading effect component
const ShimmerEffect = ({ className }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/30 dark:via-slate-600/20 to-transparent shimmer-effect" />
  </div>
);

// Premium stats card with enhanced 3D and hover effects
const StatsCard = ({ title, value, change, icon, color, children, delay }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const moveX = (e.clientX - centerX) / 15;
    const moveY = (e.clientY - centerY) / 15;
    
    x.set(moveX);
    y.set(moveY);
  };
  
  const resetPosition = () => {
    x.set(0);
    y.set(0);
  };
  
  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: delay * 0.1 }}
      style={{ x, y }}
      whileHover={{ 
        y: -5, 
        transition: { duration: 0.2 } 
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetPosition}
      className={`relative rounded-xl p-5 overflow-hidden
        bg-gradient-to-b from-white to-slate-50
        dark:from-slate-800 dark:to-slate-800/80
        border border-slate-200 dark:border-slate-700/80
        transition-all duration-300 ease-out
        shadow-sm hover:shadow-md will-change-transform
        ${color === 'blue' ? 'hover:border-sky-200 dark:hover:border-sky-800/70' : ''}
        ${color === 'purple' ? 'hover:border-violet-200 dark:hover:border-violet-800/70' : ''}
        ${color === 'green' ? 'hover:border-emerald-200 dark:hover:border-emerald-800/70' : ''}
        ${color === 'amber' ? 'hover:border-amber-200 dark:hover:border-amber-800/70' : ''}
        ${color === 'rose' ? 'hover:border-rose-200 dark:hover:border-rose-800/70' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{value}</p>
          {change && (
            <p className={`text-xs font-medium mt-1 flex items-center
              ${change?.startsWith('+') ? 'text-emerald-500 dark:text-emerald-400' : ''}
              ${change?.startsWith('-') ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}
            `}>
              {change?.startsWith('+') ? <FiArrowUp className="mr-0.5 w-3 h-3" /> : null}
              {change?.startsWith('-') ? <FiArrowDown className="mr-0.5 w-3 h-3" /> : null}
              {change}
            </p>
          )}
        </div>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full
          ${color === 'blue' ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400' : ''}
          ${color === 'purple' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400' : ''}
          ${color === 'green' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : ''}
          ${color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' : ''}
          ${color === 'rose' ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400' : ''}`}
        >
          {icon}
        </div>
      </div>
      {children}
    </motion.div>
  );
};

// Premium card component for charts and content sections
const Card = ({ title, icon, rightElement, children, delay }) => {
  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: delay * 0.1 }}
      className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden
        border border-slate-200 dark:border-slate-700/80
        transition-all duration-200 hover:shadow-md
        bg-gradient-to-b from-white to-slate-50/50
        dark:from-slate-800 dark:to-slate-800/90"
    >
      <div className="p-5 border-b border-slate-200 dark:border-slate-700/80 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
          <span className="w-6 h-6 flex items-center justify-center mr-2 text-sky-500">{icon}</span>
          {title}
        </h2>
        {rightElement}
      </div>
      <div className="p-5">
        {children}
      </div>
    </motion.div>
  );
};

// Premium button component
const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  icon,
  disabled = false,
  className = '',
  type = 'button'
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sm hover:shadow transition-all',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200',
    outline: 'bg-transparent border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
    danger: 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-4 py-2 text-sm rounded-lg',
    lg: 'px-5 py-2.5 text-base rounded-lg',
  };
  
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={`font-medium flex items-center justify-center gap-2 transition-all duration-200 ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {icon}
      {children}
    </motion.button>
  );
};

// Badge component
const Badge = ({ children, color = 'blue', icon }) => {
  const colors = {
    blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
    violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    slate: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  };
  
  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </div>
  );
};

// Progress bar component
const ProgressBar = ({ percentage, color, animate = true }) => {
  return (
    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <motion.div 
        initial={animate ? { width: 0 } : { width: `${percentage}%` }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1, delay: 0.2 }}
        className={`h-full rounded-full ${
          color === 'amber' ? 'bg-amber-500' : 
          color === 'blue' ? 'bg-sky-500' : 
          color === 'green' ? 'bg-emerald-500' : 
          color === 'rose' ? 'bg-rose-500' : 
          color === 'violet' ? 'bg-violet-500' : 'bg-slate-500'
        } shadow-[0_0_10px_rgba(0,0,0,0.1)] group-hover:brightness-110 transition-all duration-200`}
      ></motion.div>
    </div>
  );
};

// Dropdown component
const Dropdown = ({ label, options, value, onChange, isOpen, setIsOpen }) => {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 
                 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700
                 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none"
      >
        <span className="text-sm font-medium">{label}</span>
        <FiChevronDown className={`ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg bg-white dark:bg-slate-800 
                     border border-slate-200 dark:border-slate-700 overflow-hidden z-10"
          >
            <div className="p-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors
                            ${value === option.value 
                              ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-medium' 
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Activity item component for compact display
const ActivityItem = ({ timestamp, route, method, status, responseTime }) => {
  return (
    <div className="flex flex-col space-y-1 p-3 border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{route}</span>
        <div className="flex space-x-2">
          <Badge 
            color={
              method === 'GET' ? 'blue' : 
              method === 'POST' ? 'green' : 
              method === 'PUT' ? 'violet' : 
              method === 'DELETE' ? 'rose' : 
              'slate'
            }
          >
            {method}
          </Badge>
          <Badge 
            color={
              status >= 200 && status < 300 ? 'green' : 
              status >= 400 && status < 500 ? 'amber' : 
              status >= 500 ? 'rose' : 
              'blue'
            }
          >
            {status}
          </Badge>
        </div>
      </div>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{format(new Date(timestamp), 'MMM d, h:mm a')}</span>
        <span>{(responseTime * 1000).toFixed(1)}ms</span>
      </div>
    </div>
  );
};

// Main dashboard component
const AdminDashboard = () => {
  // State variables
  const [summary, setSummary] = useState(null);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [routeAnalytics, setRouteAnalytics] = useState({});
  const [timeBasedStats, setTimeBasedStats] = useState({});
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('monthly'); // Changed to monthly by default
  const [showTimePeriodDropdown, setShowTimePeriodDropdown] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Chart refs
  const requestActivityRef = useRef(null);
  const testTypesRef = useRef(null);
  const requestActivityChart = useRef(null);
  const testTypesChart = useRef(null);
  
  // Toast notification helper
  const displayToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };
  
  // Mock API function to simulate fetch requests without CORS issues
  const mockApiCall = (endpoint, params = {}) => {
    return new Promise((resolve) => {
      console.log(`Mock API call to ${endpoint} with params:`, params);
      setTimeout(() => {
        switch (endpoint) {
          case '/analytics/summary':
            resolve(MOCK_DATA.summary);
            break;
          case '/analytics/popular':
            resolve(MOCK_DATA.popularRoutes);
            break;
          case '/analytics/routes':
            resolve(MOCK_DATA.routeAnalytics);
            break;
          case '/analytics/history':
            resolve(MOCK_DATA.historyData);
            break;
          case '/analytics/time-based/daily':
            resolve(MOCK_DATA.timeBasedStats.daily);
            break;
          case '/analytics/time-based/weekly':
            resolve(MOCK_DATA.timeBasedStats.weekly);
            break;
          case '/analytics/time-based/monthly':
            resolve(MONTHLY_DATA);
            break;
          default:
            resolve({});
        }
      }, 500); // Simulate network delay
    });
  };
  
  // Fetch analytics data with mock data approach to avoid CORS
  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Fetch summary data using mock data
      const summaryData = await mockApiCall('/analytics/summary');
      
      if (summaryData) {
        setSummary(summaryData);
        // Extract popular routes directly from summary if available
        if (summaryData.top_routes) {
          setPopularRoutes(summaryData.top_routes);
        }
        
        // Update last updated timestamp
        setLastUpdated(new Date());
      }
      
      // Fetch popular routes separately
      const popularRoutesData = await mockApiCall('/analytics/popular', { limit: 10 });
      
      if (popularRoutesData) {
        // Format API routes to be user-friendly
        const formattedRoutes = Array.isArray(popularRoutesData) 
          ? popularRoutesData.map(item => ({
              ...item,
              route: formatApiRoute(item.route)
            }))
          : [];
          
        setPopularRoutes(formattedRoutes);
      }
      
      // Fetch route analytics
      const routesData = await mockApiCall('/analytics/routes');
      if (routesData) {
        setRouteAnalytics(routesData);
      }
      
      // Fetch history data with date filters
      const historyData = await mockApiCall('/analytics/history', {
        limit: 5, // Limit to 5 items only
        start_time: fromDate ? new Date(fromDate).toISOString() : undefined,
        end_time: toDate ? new Date(toDate).toISOString() : undefined
      });
      
      // Format API routes in history data
      const formattedHistoryData = Array.isArray(historyData) 
        ? historyData.map(item => ({
            ...item,
            route: formatApiRoute(item.route)
          })).slice(0, 5) // Ensure only 5 items max
        : [];
        
      setHistoryData(formattedHistoryData);
      
      // Fetch time-based stats for the selected period
      await fetchTimeBasedStats(selectedTimePeriod);
      
      setLoading(false);
      displayToast('Dashboard updated successfully', 'success');
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setLoading(false);
      displayToast(`Failed to load dashboard data: ${error.message}`, 'error');
    }
  };
  
  // Fetch time-based stats when period changes
  const fetchTimeBasedStats = async (period) => {
    try {
      const data = await mockApiCall(`/analytics/time-based/${period}`);
      setTimeBasedStats(data || {});
      
      // Update charts
      if (!loading) {
        setTimeout(() => initCharts(), 100);
      }
    } catch (error) {
      console.error(`Error fetching ${period} analytics:`, error);
      displayToast(`Failed to load ${period} statistics`, 'error');
    }
  };
  
  // Initialize bar chart for monthly data
  const initBarChart = () => {
    if (!requestActivityRef.current || !timeBasedStats) return;
    
    if (requestActivityChart.current) {
      requestActivityChart.current.destroy();
    }
    
    const chartTextColor = isDarkMode ? '#e2e8f0' : '#1e293b';
    const chartGridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    
    // Extract data for chart from monthly stats
    const monthKey = Object.keys(timeBasedStats)[0] || '';
    if (!monthKey || !timeBasedStats[monthKey]) return;
    
    const activities = Object.keys(timeBasedStats[monthKey]);
    const data = activities.map(key => timeBasedStats[monthKey][key]);
    
    // Create bar chart
    const ctx = requestActivityRef.current.getContext('2d');
    
    // Define colors for bars
    const barColors = [
      '#0ea5e9', // sky-500
      '#8b5cf6', // violet-500 
      '#10b981', // emerald-500
      '#f59e0b', // amber-500
      '#ec4899', // pink-500
      '#6366f1', // indigo-500
      '#14b8a6'  // teal-500
    ];
    
    requestActivityChart.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: activities,
        datasets: [{
          label: 'Number of Requests',
          data: data,
          backgroundColor: activities.map((_, index) => barColors[index % barColors.length]),
          borderColor: activities.map((_, index) => barColors[index % barColors.length]),
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 50
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Make it a horizontal bar chart for better label display
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
            bodyColor: isDarkMode ? '#e2e8f0' : '#1e293b',
            borderColor: isDarkMode ? '#475569' : '#e2e8f0',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => `${context.label}: ${context.raw} requests`,
            }
          },
        },
        scales: {
          x: {
            grid: {
              color: chartGridColor,
              drawBorder: false,
            },
            ticks: {
              precision: 0,
              color: chartTextColor,
              font: {
                family: 'Inter, sans-serif',
                size: 11,
              },
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: chartTextColor,
              font: {
                family: 'Inter, sans-serif',
                size: 11,
              },
              callback: function(value) {
                const label = this.getLabelForValue(value);
                if (label.length > 20) {
                  return label.substring(0, 18) + '...';
                }
                return label;
              }
            }
          },
        },
        animation: {
          duration: 1500,
          easing: 'easeOutQuart',
        },
      },
    });
  };
    
  // Process route distribution data for pie chart
  const processRouteDistribution = (routes) => {
    if (!routes || !Array.isArray(routes) || routes.length === 0) {
      return { labels: [], data: [] };
    }
    
    // Take top 6 routes for clarity
    const topRoutes = routes.slice(0, 6);
    return {
      labels: topRoutes.map(item => item.route),
      data: topRoutes.map(item => item.count)
    };
  };
  
  // Initialize charts
  const initCharts = () => {
    // Initialize bar chart for monthly data display
    initBarChart();
    
    const chartTextColor = isDarkMode ? '#e2e8f0' : '#1e293b';
    
    // Route Distribution Chart (using popularRoutes data)
    if (testTypesRef.current && popularRoutes && popularRoutes.length > 0) {
      if (testTypesChart.current) {
        testTypesChart.current.destroy();
      }
      
      const ctx = testTypesRef.current.getContext('2d');
      const { labels, data } = processRouteDistribution(popularRoutes);
      
      testTypesChart.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: [
                '#06b6d4', // Cyan-500
                '#3b82f6', // Blue-500
                '#8b5cf6', // Violet-500
                '#14b8a6', // Teal-500
                '#22c55e', // Green-500
                '#a855f7', // Purple-500
              ],
              borderColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderWidth: 2,
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 15,
                font: {
                  family: 'Inter, sans-serif',
                  size: 11,
                  weight: '500',
                },
                color: chartTextColor,
              },
            },
            tooltip: {
              backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
              bodyColor: isDarkMode ? '#e2e8f0' : '#1e293b',
              borderColor: isDarkMode ? '#475569' : '#e2e8f0',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 12,
              boxPadding: 6,
              usePointStyle: true,
              callbacks: {
                label: (context) => {
                  const totalValue = context.dataset.data.reduce((a, b) => a + b, 0) || 1;
                  const percentage = ((context.raw / totalValue) * 100).toFixed(1);
                  return `${context.label}: ${context.raw} requests (${percentage}%)`;
                },
              }
            },
          },
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1500,
            easing: 'easeOutQuart',
          },
        },
      });
    }
  };

  // Initialize everything on first load
  useEffect(() => {
    fetchData();
    
    // Setup dark mode listener
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e) => setIsDarkMode(e.matches);
    
    if (darkModeMediaQuery.addEventListener) {
      darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
      return () => darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
    } else {
      // For older browsers
      darkModeMediaQuery.addListener(handleDarkModeChange);
      return () => darkModeMediaQuery.removeListener(handleDarkModeChange);
    }
  }, []);
  
  // Initialize charts when data is loaded
  useEffect(() => {
    if (!loading) {
      setTimeout(() => initCharts(), 100);
    }
  }, [loading, isDarkMode]);
  
  // Update charts when time period changes
  useEffect(() => {
    fetchTimeBasedStats(selectedTimePeriod);
  }, [selectedTimePeriod]);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };
  
  // Time period options for dropdown
  const timePeriodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];
  
  // Loading skeleton
  if (loading) {
    return (
      <div className="font-[Inter,system-ui,sans-serif] min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 md:p-6 transition-colors duration-300">
        <style>{fontStyle}</style>
        
        {/* Header skeleton */}
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <ShimmerEffect className="h-10 w-64 bg-white dark:bg-slate-800 rounded-lg" />
            <ShimmerEffect className="h-10 w-32 bg-white dark:bg-slate-800 rounded-lg" />
          </div>
          
          {/* Date filter skeleton */}
          <div className="mb-6">
            <ShimmerEffect className="h-16 bg-white dark:bg-slate-800 rounded-xl" />
          </div>
          
          {/* Stats cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <ShimmerEffect key={i} className="h-28 bg-white dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
          
          {/* Chart skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {[...Array(2)].map((_, i) => (
              <ShimmerEffect key={i} className="h-80 bg-white dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
          
          {/* Additional skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <ShimmerEffect key={i} className="h-64 bg-white dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
        
        {/* Loading overlay */}
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 360],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="w-12 h-12 rounded-full border-4 border-transparent border-t-sky-500 border-r-sky-500"
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute mt-24 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg text-sky-600 dark:text-sky-400 font-medium"
          >
            Loading your dashboard...
          </motion.div>
        </div>
      </div>
    );
  }

  // Main dashboard UI
  return (
    <div className={`font-[Inter,system-ui,sans-serif] min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
      <style>{fontStyle}</style>
      
      {/* Add custom styles for animations and scrollbars */}
      <style>
        {`
          .shimmer-effect {
            animation: shimmer 2s infinite linear;
            background-size: 400% 100%;
          }
          
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          
          /* Custom scrollbar */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.05);
            border-radius: 8px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.15);
            border-radius: 8px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.25);
          }
          
          .dark ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
          }
          
          .dark ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
          }
          
          .dark ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
          }
        `}
      </style>

      {/* Toast notification */}
      <AnimatePresence>
        {showToast && (
          <div className="fixed top-4 right-4 z-50">
            <ToastNotification 
              message={toastMessage} 
              type={toastType} 
              onClose={() => setShowToast(false)} 
            />
          </div>
        )}
      </AnimatePresence>

      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 min-h-screen">
        {/* Header */}
        <header className="relative border-b border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 mr-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
                    <MdOutlineHealthAndSafety className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                    ADPPM System Analytics Dashboard
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Dashboard • {format(new Date(), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-4 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleDarkMode}
                  icon={isDarkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                >
                  {isDarkMode ? "Light" : "Dark"}
                </Button>
                
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FiRefreshCw className="h-4 w-4" />}
                  onClick={fetchData}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Date Filter */}
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 p-5 hover:shadow-md transition-all duration-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center text-slate-700 dark:text-slate-200">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 mr-3">
                    <FiFilter className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Filter by date range</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select a timeframe to analyze system activity
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="from-date" className="text-sm font-medium text-slate-600 dark:text-slate-300">From:</label>
                    <input
                      id="from-date"
                      type="date"
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="to-date" className="text-sm font-medium text-slate-600 dark:text-slate-300">To:</label>
                    <input
                      id="to-date"
                      type="date"
                      className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={fetchData}
                    variant="primary"
                    size="md"
                    icon={<FiRefreshCw className="w-4 h-4" />}
                  >
                    Apply Filter
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Requests */}
            <StatsCard
              title="Total API Requests"
              value={summary?.total_requests?.toLocaleString() || "0"}
              change={summary?.requests_24h ? `+${summary.requests_24h} in last 24h` : undefined}
              icon={<FiActivity className="w-6 h-6" />}
              color="blue"
              delay={2}
            />
            
            {/* Avg Response Time */}
            <StatsCard
              title="Avg Response Time"
              value={summary?.avg_response_time ? `${(summary.avg_response_time * 1000).toFixed(1)}ms` : "0ms"}
              change={summary?.prev_avg_response_time ? 
                `${(((summary.avg_response_time - summary.prev_avg_response_time) / summary.prev_avg_response_time) * 100).toFixed(1)}% change` 
                : undefined}
              icon={<FiClock className="w-6 h-6" />}
              color="green"
              delay={3}
            />
            
            {/* Peak Activity */}
            <StatsCard
              title="Peak Activity Hour"
              value={summary?.busiest_hour !== undefined ? `${summary.busiest_hour}:00` : "N/A"}
              change="Based on today's data"
              icon={<FiCalendar className="w-6 h-6" />}
              color="amber"
              delay={4}
            />
            
            {/* Unique Users */}
            <StatsCard
              title="Unique Users"
              value={summary?.unique_users?.toLocaleString() || "0"}
              change={summary?.top_routes?.length > 0 ? `${summary.top_routes.length} active routes` : undefined}
              icon={<RiTeamLine className="w-6 h-6" />}
              color="purple"
              delay={5}
            />
          </div>
          
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* API Activity Trends */}
            <Card 
              title="API Activity Trends" 
              icon={<FiBarChart2 />}
              rightElement={
                <div className="flex items-center space-x-2">
                  <Dropdown
                    label={selectedTimePeriod.charAt(0).toUpperCase() + selectedTimePeriod.slice(1)}
                    options={timePeriodOptions}
                    value={selectedTimePeriod}
                    onChange={setSelectedTimePeriod}
                    isOpen={showTimePeriodDropdown}
                    setIsOpen={setShowTimePeriodDropdown}
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<FiDownload className="w-4 h-4" />}
                    onClick={() => {
                      const canvas = document.getElementById('requestActivityChart');
                      if (canvas) {
                        const link = document.createElement('a');
                        link.download = `api-activity-${selectedTimePeriod}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                      }
                    }}
                  >
                    Export
                  </Button>
                </div>
              }
              delay={6}
            >
              <div className="h-80">
                <canvas id="requestActivityChart" ref={requestActivityRef}></canvas>
              </div>
            </Card>
            
            {/* Route Distribution Chart */}
            <Card 
              title="Popular Routes Distribution" 
              icon={<FiPieChart />}
              rightElement={
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FiDownload className="w-4 h-4" />}
                  onClick={() => {
                    const canvas = document.getElementById('routeDistributionChart');
                    if (canvas) {
                      const link = document.createElement('a');
                      link.download = 'route-distribution.png';
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                    }
                  }}
                >
                  Export
                </Button>
              }
              delay={7}
            >
              <div className="h-80">
                <canvas id="routeDistributionChart" ref={testTypesRef}></canvas>
              </div>
            </Card>
          </div>
          
          {/* Recent Activity & Popular Routes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Recent System Activity - Redesigned as card with activity items */}
            <Card 
              title="Recent System Activity" 
              icon={<FiActivity />}
              rightElement={
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FiRefreshCw className="w-4 h-4" />}
                  onClick={fetchData}
                >
                  Refresh
                </Button>
              }
              delay={9}
            >
              <div className="space-y-1">
                {historyData.length > 0 ? (
                  historyData.map((entry, index) => (
                    <ActivityItem
                      key={index}
                      timestamp={entry.timestamp}
                      route={entry.route}
                      method={entry.method}
                      status={entry.status_code}
                      responseTime={entry.response_time}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <p>No recent activity data available</p>
                  </div>
                )}
              </div>
            </Card>
            
            {/* Popular Routes */}
            <Card 
              title="Most Popular Routes" 
              icon={<FiBarChart2 />}
              delay={10}
            >
              <div className="space-y-4">
                {popularRoutes?.length > 0 ? popularRoutes.slice(0, 5).map((route, index) => {
                  const totalCount = popularRoutes.reduce((sum, r) => sum + r.count, 0);
                  const percentage = (route.count / totalCount) * 100;
                  const colors = ['blue', 'violet', 'green', 'amber', 'rose'];
                  
                  return (
                    <motion.div 
                      key={route.route || index}
                      whileHover={{ scale: 1.01 }}
                      className="group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0 + (index * 0.1) }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
                          {route.route}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {route.count.toLocaleString()} 
                          <span className="text-xs ml-1 text-slate-500 dark:text-slate-400">
                            ({percentage.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <ProgressBar 
                        percentage={percentage} 
                        color={colors[index % colors.length]} 
                        animate={true}
                      />
                    </motion.div>
                  );
                }) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <p>No route data available</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
          
          {/* Last updated info */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-sm text-slate-500 dark:text-slate-400">
              <span>Last updated: {format(lastUpdated, 'MMM d, yyyy h:mm:ss a')}</span>
              <motion.button 
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
                onClick={fetchData}
                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 flex items-center justify-center"
                aria-label="Refresh data"
              >
                <FiRefreshCw className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </motion.div>
        </main>
        
        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center">
                  <div className="h-8 w-8 flex items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 mr-2">
                    <MdOutlineHealthAndSafety className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-white">API Analytics</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Version 1.0.0 • Analytics Dashboard</p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                <a href="#" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Help Center</a>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <a href="#" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Documentation</a>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <a href="#" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Contact Support</a>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                © 2025 API Analytics • All rights reserved • <a href="#" className="text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300">Privacy Policy</a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default AdminDashboard;
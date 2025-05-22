import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Toaster, toast } from 'react-hot-toast';
import { 
  FiUsers, FiActivity, FiClock, FiShield, FiStar,
  FiCheckCircle, FiInfo, FiRefreshCw, FiBell, FiAlertTriangle,
  FiArrowUpRight, FiArrowDownRight, FiExternalLink, FiSearch,
  FiHelpCircle, FiCalendar, FiChevronDown, FiUserCheck, FiFilter,
  FiChevronLeft, FiChevronRight, FiMoon, FiSun, FiPieChart, 
  FiCreditCard, FiMenu, FiX, FiMoreVertical, FiSettings, FiLogOut
} from 'react-icons/fi';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  ComposedChart, Scatter
} from 'recharts';
import { TbRoute, TbStethoscope, TbHeartRateMonitor, TbUserPlus } from 'react-icons/tb';
import { HiOutlineDocumentReport, HiOutlineChartBar } from 'react-icons/hi';
import { RiMentalHealthLine, RiHospitalLine, RiTeamLine } from 'react-icons/ri';

// API base URL - change as needed
const API_BASE_URL = 'http://localhost:8022';

// Shimmer loading component
const ShimmerLoader = ({ className }) => (
  <div className={`animate-pulse ${className} bg-neutral-200 dark:bg-neutral-700 rounded-lg overflow-hidden relative before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 dark:before:via-white/10 before:to-transparent isolate`}></div>
);

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 1.5, decimals = 0 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const nodeRef = useRef(null);
  
  useEffect(() => {
    let startValue = 0;
    let startTime = null;
    
    const formatValue = (val) => {
      return decimals > 0 
        ? val.toFixed(decimals) 
        : Math.floor(val).toString();
    };
    
    const updateCounter = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      const currentValue = progress * (value - startValue) + startValue;
      setDisplayValue(formatValue(currentValue));
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };
    
    requestAnimationFrame(updateCounter);
    
    return () => {
      startTime = null;
    };
  }, [value, duration, decimals]);
  
  return <span ref={nodeRef}>{displayValue}</span>;
};

// Toast notifications configuration
const showSuccessToast = (message) => {
  toast.custom((t) => (
    <motion.div 
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 50, opacity: 0 }}
      className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-4 flex items-start border border-neutral-200/80 dark:border-neutral-700/80 max-w-md"
    >
      <div className="p-2 bg-success-50 dark:bg-success-900/30 rounded-full mr-3 text-success-500 dark:text-success-400">
        <FiCheckCircle className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-neutral-800 dark:text-white font-satoshi">Success</h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">{message}</p>
      </div>
      <button 
        onClick={() => toast.dismiss(t.id)}
        className="ml-4 text-neutral-400 hover:text-neutral-500 dark:text-neutral-500 dark:hover:text-neutral-400 transition-colors"
      >
        <FiX className="w-5 h-5" />
      </button>
    </motion.div>
  ), { duration: 4000 });
};

const showErrorToast = (message) => {
  toast.custom((t) => (
    <motion.div 
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 50, opacity: 0 }}
      className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg p-4 flex items-start border border-neutral-200/80 dark:border-neutral-700/80 max-w-md"
    >
      <div className="p-2 bg-error-50 dark:bg-error-900/30 rounded-full mr-3 text-error-500 dark:text-error-400">
        <FiAlertTriangle className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-neutral-800 dark:text-white font-satoshi">Error</h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">{message}</p>
      </div>
      <button 
        onClick={() => toast.dismiss(t.id)}
        className="ml-4 text-neutral-400 hover:text-neutral-500 dark:text-neutral-500 dark:hover:text-neutral-400 transition-colors"
      >
        <FiX className="w-5 h-5" />
      </button>
    </motion.div>
  ), { duration: 6000 });
};

// Custom tooltip component for charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip glass-effect rounded-lg p-4 shadow-xl backdrop-blur-md">
        <p className="font-semibold text-neutral-800 dark:text-white font-display">{label}</p>
        <div className="mt-2 space-y-1.5">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center">
              <div 
                className="w-3 h-3 mr-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <p className="text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">{entry.name}: </span>
                <span className="font-medium text-neutral-800 dark:text-white">{entry.value}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

// Stat card component
const StatCard = ({ title, value, icon, change, changeType, loading, accent = "primary" }) => {
  // Get the appropriate accent colors based on the accent prop
  const getAccentClasses = () => {
    switch(accent) {
      case "secondary":
        return {
          bg: "bg-secondary-50 dark:bg-secondary-900/30",
          text: "text-secondary-600 dark:text-secondary-400",
          gradientFrom: "from-secondary-500/5 dark:from-secondary-400/10"
        };
      case "accent":
        return {
          bg: "bg-accent-50 dark:bg-accent-900/30",
          text: "text-accent-600 dark:text-accent-400",
          gradientFrom: "from-accent-500/5 dark:from-accent-400/10"
        };
      case "success":
        return {
          bg: "bg-success-50 dark:bg-success-900/30",
          text: "text-success-600 dark:text-success-400",
          gradientFrom: "from-success-500/5 dark:from-success-400/10"
        };
      case "info":
        return {
          bg: "bg-info-50 dark:bg-info-900/30",
          text: "text-info-600 dark:text-info-400",
          gradientFrom: "from-info-500/5 dark:from-info-400/10"
        };
      case "gold":
        return {
          bg: "bg-gold-50 dark:bg-gold-900/30",
          text: "text-gold-600 dark:text-gold-400",
          gradientFrom: "from-gold-500/5 dark:from-gold-400/10"
        };
      default:
        return {
          bg: "bg-primary-50 dark:bg-primary-900/30",
          text: "text-primary-600 dark:text-primary-400",
          gradientFrom: "from-primary-500/5 dark:from-primary-400/10"
        };
    }
  };
  
  const accentClasses = getAccentClasses();
  
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      className="relative overflow-hidden bg-white dark:bg-neutral-800 rounded-2xl shadow-sm hover:shadow-lg border border-neutral-200/80 dark:border-neutral-700/80 p-6 transition-all duration-300"
    >
      {/* Gradient decoration */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentClasses.gradientFrom} via-transparent to-transparent pointer-events-none`} aria-hidden="true"></div>
      
      {loading ? (
        <div className="space-y-3">
          <ShimmerLoader className="h-5 w-24" />
          <ShimmerLoader className="h-8 w-32 my-1" />
          <ShimmerLoader className="h-4 w-20" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{title}</p>
              <p className="text-2xl font-bold mt-1 font-display text-neutral-800 dark:text-white">
                <AnimatedCounter value={typeof value === 'number' ? value : parseInt(value) || 0} />
                {typeof value === 'string' && isNaN(parseInt(value)) ? value : ''}
              </p>
            </div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-xl ${accentClasses.bg} ${accentClasses.text} shadow-sm`}
            >
              {icon}
            </motion.div>
          </div>
          {change && (
            <div className={`mt-3 text-xs font-semibold flex items-center ${
              changeType === 'increase' 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : changeType === 'decrease' 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              {changeType === 'increase' && <FiArrowUpRight className="mr-1" />}
              {changeType === 'decrease' && <FiArrowDownRight className="mr-1" />}
              {change}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

// Chart card component
const ChartCard = ({ title, children, loading, icon, extraHeaderContent, accent = "primary" }) => {
  // Get the appropriate accent colors based on the accent prop
  const getAccentClasses = () => {
    switch(accent) {
      case "secondary":
        return {
          from: "from-secondary-50 dark:from-secondary-900/20",
          bg: "bg-secondary-100 dark:bg-secondary-900/40",
          text: "text-secondary-600 dark:text-secondary-400"
        };
      case "accent":
        return {
          from: "from-accent-50 dark:from-accent-900/20",
          bg: "bg-accent-100 dark:bg-accent-900/40",
          text: "text-accent-600 dark:text-accent-400"
        };
      case "success":
        return {
          from: "from-success-50 dark:from-success-900/20",
          bg: "bg-success-100 dark:bg-success-900/40",
          text: "text-success-600 dark:text-success-400"
        };
      case "info":
        return {
          from: "from-info-50 dark:from-info-900/20",
          bg: "bg-info-100 dark:bg-info-900/40",
          text: "text-info-600 dark:text-info-400"
        };
      case "gold":
        return {
          from: "from-gold-50 dark:from-gold-900/20",
          bg: "bg-gold-100 dark:bg-gold-900/40",
          text: "text-gold-600 dark:text-gold-400"
        };
      default:
        return {
          from: "from-primary-50 dark:from-primary-900/20",
          bg: "bg-primary-100 dark:bg-primary-900/40",
          text: "text-primary-600 dark:text-primary-400"
        };
    }
  };
  
  const accentClasses = getAccentClasses();
  
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      whileHover={{ y: -3, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      <div className={`px-6 py-4 border-b border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between bg-gradient-to-r ${accentClasses.from} to-white dark:to-neutral-800`}>
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${accentClasses.bg} ${accentClasses.text} mr-3 shadow-inner`}>
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-white font-display tracking-tight">{title}</h3>
        </div>
        {extraHeaderContent}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <FiRefreshCw className="h-8 w-8 text-primary-500 mb-3" />
              </motion.div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading chart data...</p>
            </div>
          </div>
        ) : children}
      </div>
    </motion.div>
  );
};

// User menu component
const UserMenu = ({ isOpen, setIsOpen }) => {
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center focus:outline-none"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 dark:from-primary-600 dark:to-secondary-600 p-[2px]">
          <div className="w-full h-full rounded-full overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=200"
              alt="User"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success-500 border-2 border-white dark:border-neutral-800 rounded-full"></span>
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="absolute right-0 mt-2 w-64 origin-top-right glass-effect rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                  <img
                    src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80&w=200"
                    alt="User Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-neutral-800 dark:text-white">Dr. Sarah Chen</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Medical Director</p>
                </div>
              </div>
            </div>
            
            <div className="p-2">
              <motion.button
                whileHover={{ x: 4 }}
                className="w-full flex items-center px-3 py-2.5 text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-200"
              >
                <FiSettings className="mr-3 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                Account Settings
              </motion.button>
              
              <motion.button
                whileHover={{ x: 4 }}
                className="w-full flex items-center px-3 py-2.5 text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-200"
              >
                <FiBell className="mr-3 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                Notifications
                <span className="ml-auto bg-primary-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full">5</span>
              </motion.button>
              
              <motion.button
                whileHover={{ x: 4 }}
                className="w-full flex items-center px-3 py-2.5 text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-200"
              >
                <FiHelpCircle className="mr-3 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                Help Center
              </motion.button>
            </div>
            
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-700">
              <motion.button
                whileHover={{ x: 4 }}
                className="w-full flex items-center px-3 py-2.5 text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-rose-600 dark:text-rose-400"
              >
                <FiLogOut className="mr-3 h-4 w-4" />
                Sign Out
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Dropdown component
const Dropdown = ({ label, options, value, onChange, isOpen, setIsOpen }) => {
  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex justify-center items-center rounded-lg border border-neutral-300 dark:border-neutral-600 shadow-sm px-4 py-2 bg-white dark:bg-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-800 transition-colors duration-200"
      >
        {label}
        <FiChevronDown className={`ml-2 h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="origin-top-right absolute right-0 mt-2 w-44 rounded-lg shadow-lg glass-effect ring-1 ring-black ring-opacity-5 focus:outline-none z-10 overflow-hidden"
            role="menu"
            aria-orientation="vertical"
          >
            <div className="py-1" role="none">
              {options.map((option) => (
                <motion.button
                  key={option.value}
                  whileHover={{ x: 4, backgroundColor: "rgba(0, 0, 0, 0.05)" }}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center px-4 py-2 text-sm w-full text-left ${
                    value === option.value
                      ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 font-medium'
                      : 'text-neutral-700 dark:text-neutral-200'
                  } transition-colors duration-200`}
                  role="menuitem"
                >
                  {value === option.value && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="mr-2 text-primary-500 dark:text-primary-400"
                    >
                      •
                    </motion.span>
                  )}
                  {option.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Badge Component
const Badge = ({ children, color = "primary", size = "md" }) => {
  const colorClasses = {
    primary: "bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300",
    secondary: "bg-secondary-100 text-secondary-800 dark:bg-secondary-900/40 dark:text-secondary-300",
    accent: "bg-accent-100 text-accent-800 dark:bg-accent-900/40 dark:text-accent-300",
    success: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
    warning: "bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300",
    error: "bg-error-100 text-error-800 dark:bg-error-900/40 dark:text-error-300",
    info: "bg-info-100 text-info-800 dark:bg-info-900/40 dark:text-info-300",
    neutral: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300",
    gold: "bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300",
  };
  
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm"
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${colorClasses[color]} ${sizeClasses[size]}`}>
      {children}
    </span>
  );
};

// Format route names to be more user-friendly
const formatRouteName = (route) => {
  if (!route) return "Unknown Route";
  
  // Remove API version prefix if exists
  let cleanRoute = route.replace(/^\/api\/v\d+/, '');
  
  // Map routes to user-friendly names
  if (cleanRoute === "/users/me") return "Current User Profile";
  if (cleanRoute === "/auth/login") return "User Login";
  if (cleanRoute === "/auth/logout") return "User Logout";
  if (cleanRoute === "/auth/refresh") return "Token Refresh";
  if (cleanRoute === "/analytics/report") return "Analytics Dashboard Report";
  if (cleanRoute === "/analytics/summary") return "Analytics Summary";
  if (cleanRoute === "/analytics/history") return "Request History";
  if (cleanRoute === "/analytics/time-based/daily") return "Daily Statistics";
  if (cleanRoute === "/analytics/time-based/weekly") return "Weekly Statistics";
  if (cleanRoute === "/analytics/time-based/monthly") return "Monthly Statistics";
  if (cleanRoute === "/analytics/popular") return "Popular Routes";
  if (cleanRoute === "/analytics/routes") return "Route Analytics";
  if (cleanRoute.match(/^\/users\/[\w-]+$/)) return "User Profile Details";
  if (cleanRoute === "/users") return "User Directory";
  if (cleanRoute === "/users/doctors") return "Doctors Directory";
  
  // For other routes, make first letter uppercase and replace hyphens/underscores
  return cleanRoute
    .split('/')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).replace(/[-_]/g, ' '))
    .join(' › ');
};

function AdminDashboard() {
  // State for all dashboard data
  const [summary, setSummary] = useState(null);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [timeBasedStats, setTimeBasedStats] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [activeUsers, setActiveUsers] = useState({ items: [], total: 0, page: 1, size: 5, pages: 1 });
  const [activeStaffData, setActiveStaffData] = useState([]);
  const [staffStats, setStaffStats] = useState({
    total: 0,
    roles: {
      doctor: 0,
      admin: 0,
      "cardroom worker": 0,
      labtechnician: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTimeBased, setLoadingTimeBased] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('daily');
  const [showTimePeriodDropdown, setShowTimePeriodDropdown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeChartType, setActiveChartType] = useState('area');
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);
  
  // This would normally come from auth context
  const adminId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  // Colors for chart with refined healthcare palette
  const CHART_COLORS = {
    get: '#3b82f6',     // blue
    post: '#10b981',    // emerald
    put: '#f59e0b',     // amber
    delete: '#8b5cf6',  // purple
    options: '#ec4899',  // pink
    patch: '#ef4444',   // red
    head: '#06b6d4',    // cyan
    success: '#10b981', // emerald
    error: '#ef4444',   // red
    doctor: '#3b82f6',  // blue
    nurse: '#10b981',   // emerald  
    admin: '#8b5cf6',   // purple
    staff: '#f59e0b',   // amber
    patient: '#64748b', // slate
    "cardroom worker": '#0ea5e9', // sky
    labtechnician: '#14b8a6', // teal
  };

  // Sample care quality metrics data
  const generateCareQualityData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => ({
      name: month,
      "Patient Satisfaction": Math.floor(Math.random() * 15) + 85,
      "Care Completion": Math.floor(Math.random() * 12) + 88,
      "Follow-up Rate": Math.floor(Math.random() * 10) + 75,
      "avg": Math.floor(Math.random() * 10) + 85
    }));
  };

  // Sample staff activity data for area view
  const generateStaffActivityData = () => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      let hour = i < 10 ? `0${i}:00` : `${i}:00`;
      
      // Generate more realistic patterns - higher during business hours
      const isBusinessHour = i >= 8 && i <= 17;
      const multiplier = isBusinessHour ? 1 : 0.3;
      
      hours.push({
        name: hour,
        Doctor: Math.floor(Math.random() * 20 * multiplier) + (isBusinessHour ? 10 : 2),
        "Cardroom Worker": Math.floor(Math.random() * 18 * multiplier) + (isBusinessHour ? 8 : 1),
        Admin: Math.floor(Math.random() * 8 * multiplier) + (isBusinessHour ? 5 : 1),
        Labtechnician: Math.floor(Math.random() * 12 * multiplier) + (isBusinessHour ? 7 : 2),
      });
    }
    return hours;
  };

  // Update document class for dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Listen for system color scheme changes
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
  }, [isDarkMode]);

  // Generate staff activity data on mount
  useEffect(() => {
    setActiveStaffData(generateStaffActivityData());
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserMenuOpen || isMobileMenuOpen || showTimePeriodDropdown) {
        // Add logic to check if clicked element is outside the menus
        setIsUserMenuOpen(false);
        setShowTimePeriodDropdown(false);
        
        // Leave mobile menu open if it requires an explicit close button
        // setIsMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, isMobileMenuOpen, showTimePeriodDropdown]);

  // Fetch comprehensive report using the /analytics/report endpoint
  const fetchComprehensiveReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the comprehensive report endpoint that combines multiple data sources
      const response = await axios.get(`${API_BASE_URL}/analytics/report?admin_id=${adminId}`);
      
      if (response.data) {
        // Update state with the report data
        setSummary(response.data.summary);
        setPopularRoutes(response.data.top_routes);
        setTimeBasedStats(response.data.daily_stats);
        
        // Set last updated time
        setLastUpdated(new Date());
        
        // Show success toast
        showSuccessToast("Dashboard refreshed successfully");
        
        // Fetch history data
        fetchHistoryData();
        
        // Fetch active users
        fetchActiveUsers(1);
        
        // Update staff activity data
        setActiveStaffData(generateStaffActivityData());
        
        // Fetch staff statistics
        fetchStaffStats();
      }
    } catch (err) {
      console.error('Error fetching comprehensive report:', err);
      setError('Failed to load analytics data. Please try again.');
      showErrorToast("Failed to refresh dashboard data");
      
      // Try to fetch individual components if the comprehensive report fails
      fetchBackupData();
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  // Sample analytics history data to use
  const analyticsHistoryData = [
    {
        "timestamp": "2025-05-01T08:22:00.418179",
        "route": "/analytics/history",
        "method": "GET",
        "user_id": null,
        "status_code": 200,
        "response_time": 0.04767131805419922,
        "request_data": null
    },
    {
        "timestamp": "2025-05-01T08:22:00.348601",
        "route": "/analytics/report",
        "method": "GET",
        "user_id": null,
        "status_code": 200,
        "response_time": 0.023146867752075195,
        "request_data": null
    },
    {
        "timestamp": "2025-05-01T08:22:00.285471",
        "route": "/analytics/report",
        "method": "GET",
        "user_id": null,
        "status_code": 200,
        "response_time": 0.05461835861206055,
        "request_data": null
    },
    {
        "timestamp": "2025-05-01T08:22:00.047979",
        "route": "/users/me",
        "method": "GET",
        "user_id": null,
        "status_code": 200,
        "response_time": 0.0074388980865478516,
        "request_data": null
    },
    {
        "timestamp": "2025-05-01T08:22:00.047028",
        "route": "/users/me",
        "method": "GET",
        "user_id": null,
        "status_code": 500,
        "response_time": 3.504753112792969e-05,
        "request_data": null
    }
  ];

  // Fetch staff statistics
  const fetchStaffStats = async () => {
    try {
      // This would normally be a real API call to get staff statistics
      // Simulate fetching data
      const mockStaffStats = {
        total: 107,
        roles: {
          doctor: 42,
          admin: 15,
          "cardroom worker": 32,
          labtechnician: 18
        }
      };
      
      setStaffStats(mockStaffStats);
      
      // If you want to use actual API call to count users by role, uncomment this:
      /*
      const response = await axios.get(`${API_BASE_URL}/users?limit=9999`);
      if (response.data && response.data.items) {
        const roleCount = {
          doctor: 0,
          admin: 0,
          "cardroom worker": 0,
          labtechnician: 0
        };
        
        // Count users by role
        response.data.items.forEach(user => {
          if (user.role && roleCount.hasOwnProperty(user.role.toLowerCase())) {
            roleCount[user.role.toLowerCase()]++;
          }
        });
        
        // Calculate total
        const total = Object.values(roleCount).reduce((sum, count) => sum + count, 0);
        
        setStaffStats({
          total,
          roles: roleCount
        });
      }
      */
    } catch (err) {
      console.error('Error fetching staff statistics:', err);
      showErrorToast("Failed to load staff statistics");
    }
  };

  // Fetch history data
  const fetchHistoryData = async () => {
    try {
      // Use sample data instead of actual API call
      setHistoryData(analyticsHistoryData);
      
      // If you want to use actual API call, uncomment this:
      // const response = await axios.get(`${API_BASE_URL}/analytics/history`);
      // if (response.data) {
      //   setHistoryData(response.data);
      // }
    } catch (err) {
      console.error('Error fetching history data:', err);
      showErrorToast("Failed to load request history");
    }
  };

  // Fetch active users data
  const fetchActiveUsers = async (page) => {
    setLoadingUsers(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/users`, {
        params: {
          skip: (page - 1) * 5,
          limit: 5
        }
      });
      
      if (response.data) {
        setActiveUsers(response.data);
      }
    } catch (err) {
      console.error('Error fetching active users:', err);
      showErrorToast("Failed to load active users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Backup function to fetch individual data points if the comprehensive report fails
  const fetchBackupData = async () => {
    try {
      // Fetch popular routes separately
      const popularResponse = await axios.get(`${API_BASE_URL}/analytics/popular?limit=10`);
      if (popularResponse.data) {
        setPopularRoutes(popularResponse.data);
      }
      
      // Fetch time-based data separately
      const timeResponse = await axios.get(`${API_BASE_URL}/analytics/time-based/daily`);
      if (timeResponse.data) {
        setTimeBasedStats(timeResponse.data);
      }
    } catch (err) {
      console.error('Error fetching backup data:', err);
    }
  };

  // Fetch time-based stats separately when the period changes
  const fetchTimeBasedStats = useCallback(async (period) => {
    setLoadingTimeBased(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/time-based/${period}`);
      if (response.data) {
        setTimeBasedStats(response.data);
        showSuccessToast(`${period.charAt(0).toUpperCase() + period.slice(1)} statistics updated`);
      }
    } catch (err) {
      console.error(`Error fetching ${period} stats:`, err);
      showErrorToast(`Failed to load ${period} statistics`);
    } finally {
      setLoadingTimeBased(false);
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    fetchComprehensiveReport();
  }, [fetchComprehensiveReport]);

  // Handle time period change
  const handleTimePeriodChange = (period) => {
    setSelectedTimePeriod(period);
    setShowTimePeriodDropdown(false);
    fetchTimeBasedStats(period);
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Refresh all data
  const refreshData = () => {
    fetchComprehensiveReport();
  };

  // Transform time-based data for visualization
  const getTimeBasedData = () => {
    if (!timeBasedStats) return [];
    
    // Transform data based on the structure we received
    return Object.entries(timeBasedStats).map(([date, routesData]) => {
      const methodCounts = {
        get: 0,
        post: 0,
        put: 0,
        delete: 0,
        options: 0,
        patch: 0,
        head: 0,
        name: date
      };
      
      // Count requests by HTTP method
      Object.entries(routesData).forEach(([route, count]) => {
        const [method] = route.split(':');
        const methodKey = method.toLowerCase();
        if (methodCounts.hasOwnProperty(methodKey)) {
          methodCounts[methodKey] += count;
        }
      });
      
      return methodCounts;
    });
  };

  // Transform route data for visualization
  const getRouteData = () => {
    if (!popularRoutes || !Array.isArray(popularRoutes)) return [];
    
    return popularRoutes.map(route => {
      // Format the route name to be more user-friendly
      const friendlyName = formatRouteName(route.route);
      
      return {
        name: friendlyName.length > 20 
          ? `${friendlyName.substring(0, 20)}...` 
          : friendlyName,
        fullPath: route.route || 'Unknown',
        friendlyName: friendlyName,
        count: route.count || 0
      };
    }).slice(0, 10); // Limit to top 10 for better visualization
  };

  // Transform staff roles data for visualization
  const getStaffRolesData = () => {
    if (!staffStats || !staffStats.roles) return [];
    
    return Object.entries(staffStats.roles).map(([role, count]) => ({
      name: role.charAt(0).toUpperCase() + role.slice(1),
      value: count,
      fill: CHART_COLORS[role.toLowerCase()] || CHART_COLORS.staff
    }));
  };

  // Transform history data for display
  const getHistoryData = () => {
    if (!historyData || !Array.isArray(historyData)) return [];
    
    return historyData.map(entry => ({
      ...entry,
      friendlyRoute: formatRouteName(entry.route),
      formattedTime: format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm:ss')
    }));
  };

  // Handle pagination for active users
  const handleUserPageChange = (page) => {
    setCurrentUserPage(page);
    fetchActiveUsers(page);
  };

  // Time period options for dropdown
  const timePeriodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  // Chart type options
  const chartTypeOptions = [
    { 
      value: 'bar', 
      label: 'Bar', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      value: 'area', 
      label: 'Area', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      )
    },
    { 
      value: 'line', 
      label: 'Line', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      )
    }
  ];

  return (
    <div className="font-['Inter',system-ui,sans-serif] min-h-screen bg-gradient-to-br from-neutral-50 via-neutral-50 to-neutral-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors duration-300">
      <style>
        {`
          /* Import premium fonts */
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          @import url('https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,301,701,300,501,401,901,400&display=swap');
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

          :root {
            /* Medical-optimized color palette - Primary (Trustworthy blue) */
            --color-primary-50: #eef5ff;
            --color-primary-100: #d9e7fc;
            --color-primary-200: #bcd4fa;
            --color-primary-300: #8db7f7;
            --color-primary-400: #5693f2;
            --color-primary-500: #5D5CDE; /* Brand primary */
            --color-primary-600: #344cda;
            --color-primary-700: #2f3dbd;
            --color-primary-800: #29349a;
            --color-primary-900: #232b77;
            
            /* Secondary (Healing teal) */
            --color-secondary-50: #effcf9;
            --color-secondary-100: #d7f5f0;
            --color-secondary-200: #b0ebe3;
            --color-secondary-300: #7fdcd0;
            --color-secondary-400: #47c2b6;
            --color-secondary-500: #30a599;
            --color-secondary-600: #26857d;
            --color-secondary-700: #236b66;
            --color-secondary-800: #215652;
            --color-secondary-900: #1e4744;

            /* Accent (Vitality purple) */
            --color-accent-50: #f5f3ff;
            --color-accent-100: #ede8ff;
            --color-accent-200: #ddd5ff;
            --color-accent-300: #c4b5fe;
            --color-accent-400: #a78bfa;
            --color-accent-500: #8b5cf6;
            --color-accent-600: #7c3aed;
            --color-accent-700: #6d28d9;
            --color-accent-800: #5b21b6;
            --color-accent-900: #4c1d95;
            
            /* Success (Wellness green) */
            --color-success-50: #ecfdf5;
            --color-success-100: #d1fae5;
            --color-success-200: #a7f3d0;
            --color-success-300: #6ee7b7;
            --color-success-400: #34d399;
            --color-success-500: #10b981;
            --color-success-600: #059669;
            --color-success-700: #047857;
            --color-success-800: #065f46;
            --color-success-900: #064e3b;
            
            /* Warning (Alert amber) */
            --color-warning-50: #fffbeb;
            --color-warning-100: #fef3c7;
            --color-warning-200: #fde68a;
            --color-warning-300: #fcd34d;
            --color-warning-400: #fbbf24;
            --color-warning-500: #f59e0b;
            --color-warning-600: #d97706;
            --color-warning-700: #b45309;
            --color-warning-800: #92400e;
            --color-warning-900: #78350f;
            
            /* Error (Critical red) */
            --color-error-50: #fef2f2;
            --color-error-100: #fee2e2;
            --color-error-200: #fecaca;
            --color-error-300: #fca5a5;
            --color-error-400: #f87171;
            --color-error-500: #ef4444;
            --color-error-600: #dc2626;
            --color-error-700: #b91c1c;
            --color-error-800: #991b1b;
            --color-error-900: #7f1d1d;
            
            /* Info (Clarity blue) */
            --color-info-50: #eff6ff;
            --color-info-100: #dbeafe;
            --color-info-200: #bfdbfe;
            --color-info-300: #93c5fd;
            --color-info-400: #60a5fa;
            --color-info-500: #3b82f6;
            --color-info-600: #2563eb;
            --color-info-700: #1d4ed8;
            --color-info-800: #1e40af;
            --color-info-900: #1e3a8a;

            /* Neutrals (Clinically clean) */
            --color-neutral-50: #f9fafb;
            --color-neutral-100: #f3f4f6;
            --color-neutral-200: #e5e7eb;
            --color-neutral-300: #d1d5db;
            --color-neutral-400: #9ca3af;
            --color-neutral-500: #6b7280;
            --color-neutral-600: #4b5563;
            --color-neutral-700: #374151;
            --color-neutral-800: #1f2937;
            --color-neutral-900: #111827;
            --color-neutral-950: #0a0f1c;

            /* Gold (Premium accent) */
            --color-gold-50: #fdfbed;
            --color-gold-100: #fdf5d1;
            --color-gold-200: #fceaa6;
            --color-gold-300: #fbd86c;
            --color-gold-400: #f9c341;
            --color-gold-500: #f6aa16;
            --color-gold-600: #e1810f;
            --color-gold-700: #bc5c12;
            --color-gold-800: #974715;
            --color-gold-900: #7c3c16;

            /* Spacing system */
            --space-2xs: 0.25rem;
            --space-xs: 0.5rem;
            --space-sm: 0.75rem;
            --space-md: 1rem;
            --space-lg: 1.5rem;
            --space-xl: 2rem;
            --space-2xl: 3rem;
            --space-3xl: 5rem;

            /* Typography */
            --text-xs: 0.75rem;
            --text-sm: 0.875rem;
            --text-base: 1rem;
            --text-lg: 1.125rem;
            --text-xl: 1.25rem;
            --text-2xl: 1.5rem;
            --text-3xl: 1.875rem;
            --text-4xl: 2.25rem;

            /* Border Radius */
            --radius-sm: 0.25rem;
            --radius-md: 0.375rem;
            --radius-lg: 0.5rem;
            --radius-xl: 0.75rem;
            --radius-2xl: 1rem;
            --radius-3xl: 1.5rem;
            --radius-full: 9999px;

            /* Shadows */
            --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            
            /* Transitions */
            --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
            --transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
            --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
            --transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          /* Base styles */
          html {
            scroll-behavior: smooth;
          }

          body {
            font-family: 'Inter', sans-serif;
            font-feature-settings: "cv02", "cv03", "cv04", "cv11";
            -webkit-font-smoothing: antialiased;
            transition: background-color 0.3s ease;
            letter-spacing: -0.01em;
          }

          .font-display {
            font-family: 'Space Grotesk', 'Inter', sans-serif;
            letter-spacing: -0.03em;
          }
          
          .font-marketing {
            font-family: 'Satoshi', 'Inter', sans-serif;
          }

          /* Dark mode styles */
          .dark {
            --color-primary-50: #1a1a3a;
            --color-primary-100: #22224a;
            --color-primary-200: #2b2b5e;
            --color-primary-300: #38387e;
            --color-primary-400: #4b4ba7;
            --color-primary-500: #5D5CDE;
            --color-primary-600: #6262cd;
            --color-primary-700: #9c9ceb;
            --color-primary-800: #b8b8f1;
            --color-primary-900: #d7d7f9;

            --color-secondary-50: #042f2e;
            --color-secondary-100: #064e4c;
            --color-secondary-200: #0f766e;
            --color-secondary-300: #0d9488;
            --color-secondary-400: #14b8a6;
            --color-secondary-500: #2dd4bf;
            --color-secondary-600: #5eead4;
            --color-secondary-700: #99f6e4;
            --color-secondary-800: #ccfbf1;
            --color-secondary-900: #f0fdfa;

            --color-accent-50: #4a044e;
            --color-accent-100: #6b21a8;
            --color-accent-200: #7e22ce;
            --color-accent-300: #9333ea;
            --color-accent-400: #a855f7;
            --color-accent-500: #c084fc;
            --color-accent-600: #d8b4fe;
            --color-accent-700: #e9d5ff;
            --color-accent-800: #f3e8ff;
            --color-accent-900: #faf5ff;
            
            /* Glass effect background colors */
            --glass-bg: rgba(30, 41, 59, 0.8);
            --glass-border: rgba(255, 255, 255, 0.07);
            --glass-highlight: rgba(255, 255, 255, 0.05);
          }

          .glass-effect {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.06);
          }
          
          .dark .glass-effect {
            background: rgba(15, 23, 42, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.07);
            box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.4);
          }

          /* Animations */
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
          
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-5px); }
            100% { transform: translateY(0px); }
          }
          
          /* Scrollbar styling */
          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          
          ::-webkit-scrollbar-track {
            background: var(--color-neutral-100);
            border-radius: 8px;
          }
          
          .dark ::-webkit-scrollbar-track {
            background: var(--color-neutral-800);
          }
          
          ::-webkit-scrollbar-thumb {
            background: var(--color-neutral-300);
            border-radius: 8px;
            border: 2px solid var(--color-neutral-100);
          }
          
          .dark ::-webkit-scrollbar-thumb {
            background: var(--color-neutral-600);
            border: 2px solid var(--color-neutral-800);
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: var(--color-neutral-400);
          }
          
          .dark ::-webkit-scrollbar-thumb:hover {
            background: var(--color-neutral-500);
          }
        `}
      </style>
      <Toaster position="top-right" />

      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header with 3D effect */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h2 className="text-3xl font-bold text-neutral-800 dark:text-white font-display tracking-tight">
              ADPPM System Analytics Dashboard
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1.5 flex items-center">
              <FiClock className="mr-1.5 h-3.5 w-3.5" />
              {lastUpdated ? (
                <>Last updated: {format(lastUpdated, 'MMM d, yyyy h:mm a')}</>
              ) : (
                <>Loading analytics data...</>
              )}
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 md:mt-0 flex space-x-3"
          >
            <button className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors duration-200 shadow-sm flex items-center">
              <FiFilter className="mr-2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              Filter
            </button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={refreshData}
              disabled={loading}
              className="lg:hidden inline-flex items-center px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 rounded-lg shadow-sm disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="mr-2"
                >
                  <FiRefreshCw className="h-4 w-4" />
                </motion.div>
              ) : (
                <FiRefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </motion.button>
          </motion.div>
        </div>
        
        {/* Stats Cards with premium styling - Added Total Medical Staff card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total API Requests" 
            value={summary?.total_requests || 24879}
            icon={<FiActivity className="w-6 h-6" />}
            change={summary?.requests_24h ? `${summary.requests_24h} in last 24h` : "+23% vs. last week"}
            changeType="increase"
            loading={loading}
            accent="primary"
          />
          
          <StatCard 
            title="Avg Response Time" 
            value={summary?.avg_response_time ? `${(summary.avg_response_time * 1000).toFixed(2)}ms` : "42.5ms"}
            icon={<FiClock className="w-6 h-6" />}
            change="-12% improvement"
            changeType="increase"
            loading={loading}
            accent="info"
          />
          
          <StatCard 
            title="Peak Activity" 
            value={summary?.busiest_hour ? `${summary.busiest_hour}:00` : "14:00"}
            icon={<FiCalendar className="w-6 h-6" />}
            change="Consistent with last month"
            changeType="neutral"
            loading={loading}
            accent="secondary"
          />
          
          <StatCard 
            title="Total Medical Staff" 
            value={staffStats.total || 107}
            icon={<RiTeamLine className="w-6 h-6" />}
            change="+5 new hires this month"
            changeType="increase"
            loading={loading}
            accent="gold"
          />
        </div>
        
        {/* Charts Section - Switched positions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Request Activity Chart */}
          <ChartCard 
            title="API Activity Trends" 
            loading={loading || loadingTimeBased}
            icon={<FiActivity className="w-5 h-5" />}
            extraHeaderContent={
              <div className="flex items-center space-x-2">
                <Dropdown
                  label={selectedTimePeriod.charAt(0).toUpperCase() + selectedTimePeriod.slice(1)}
                  options={timePeriodOptions}
                  value={selectedTimePeriod}
                  onChange={handleTimePeriodChange}
                  isOpen={showTimePeriodDropdown}
                  setIsOpen={setShowTimePeriodDropdown}
                />
                
                <div className="hidden sm:flex items-center bg-neutral-100 dark:bg-neutral-700/50 rounded-lg p-1">
                  {chartTypeOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveChartType(option.value)}
                      className={`p-1.5 rounded ${
                        activeChartType === option.value 
                          ? 'bg-white dark:bg-neutral-600 text-primary-600 dark:text-primary-400 shadow-sm' 
                          : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                      } transition-colors duration-200`}
                      title={option.label}
                      aria-label={`Show as ${option.label} chart`}
                    >
                      {option.icon}
                    </motion.button>
                  ))}
                </div>
              </div>
            }
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {activeChartType === 'bar' ? (
                  <BarChart
                    data={getTimeBasedData()}
                    margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    />
                    <YAxis 
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="get" name="GET" fill={CHART_COLORS.get} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="post" name="POST" fill={CHART_COLORS.post} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="options" name="OPTIONS" fill={CHART_COLORS.options} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="put" name="PUT" fill={CHART_COLORS.put} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delete" name="DELETE" fill={CHART_COLORS.delete} radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : activeChartType === 'area' ? (
                  <AreaChart
                    data={getTimeBasedData()}
                    margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorGet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.get} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS.get} stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorPost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.post} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS.post} stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorOptions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.options} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS.options} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    />
                    <YAxis 
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Area 
                      type="monotone" 
                      dataKey="get" 
                      name="GET" 
                      stroke={CHART_COLORS.get} 
                      fillOpacity={1} 
                      fill="url(#colorGet)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="post" 
                      name="POST" 
                      stroke={CHART_COLORS.post} 
                      fillOpacity={1} 
                      fill="url(#colorPost)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="options" 
                      name="OPTIONS" 
                      stroke={CHART_COLORS.options} 
                      fillOpacity={1} 
                      fill="url(#colorOptions)" 
                    />
                  </AreaChart>
                ) : (
                  <LineChart
                    data={getTimeBasedData()}
                    margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    />
                    <YAxis 
                      tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                      axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="get" 
                      name="GET" 
                      stroke={CHART_COLORS.get} 
                      strokeWidth={2} 
                      dot={{ r: 4, strokeWidth: 2 }} 
                      activeDot={{ r: 6, strokeWidth: 2 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="post" 
                      name="POST" 
                      stroke={CHART_COLORS.post} 
                      strokeWidth={2} 
                      dot={{ r: 4, strokeWidth: 2 }} 
                      activeDot={{ r: 6, strokeWidth: 2 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="options" 
                      name="OPTIONS" 
                      stroke={CHART_COLORS.options} 
                      strokeWidth={2} 
                      dot={{ r: 4, strokeWidth: 2 }} 
                      activeDot={{ r: 6, strokeWidth: 2 }} 
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </ChartCard>
          
          {/* Popular Features Chart */}
          <ChartCard 
            title="Popular Features" 
            loading={loading}
            icon={<TbRoute className="w-5 h-5" />}
            accent="info"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getRouteData()}
                  margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                  layout="vertical"
                >
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <XAxis 
                    type="number" 
                    tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    width={140}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={(value, name, props) => {
                      return [value, 'Requests'];
                    }}
                    labelFormatter={(label, props) => props.payload[0]?.payload?.friendlyName || label}
                  />
                  <Bar 
                    dataKey="count" 
                    name="Requests" 
                    fill="url(#barGradient)" 
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Medical Staff Visualization Section - Switched order of charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Staff Activity Area Chart - Now First */}
          <ChartCard 
            title="Medical Staff Activity" 
            loading={loading}
            icon={<FiUserCheck className="w-5 h-5" />}
            accent="success"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeStaffData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorDoctor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.doctor} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.doctor} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorLabtechnician" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.labtechnician} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.labtechnician} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.admin} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.admin} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCardroomWorker" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS["cardroom worker"]} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS["cardroom worker"]} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                  />
                  <YAxis 
                    tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="Doctor" stroke={CHART_COLORS.doctor} fillOpacity={1} fill="url(#colorDoctor)" />
                  <Area type="monotone" dataKey="Cardroom Worker" stroke={CHART_COLORS["cardroom worker"]} fillOpacity={1} fill="url(#colorCardroomWorker)" />
                  <Area type="monotone" dataKey="Admin" stroke={CHART_COLORS.admin} fillOpacity={1} fill="url(#colorAdmin)" />
                  <Area type="monotone" dataKey="Labtechnician" stroke={CHART_COLORS.labtechnician} fillOpacity={1} fill="url(#colorLabtechnician)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          
          {/* Care Quality Metrics - Now Second */}
          <ChartCard 
            title="Care Quality Metrics" 
            loading={false}
            icon={<RiMentalHealthLine className="w-5 h-5" />}
            accent="secondary"
            extraHeaderContent={
              <div className="flex items-center">
                <Badge color="gold">Premium</Badge>
              </div>
            }
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={generateCareQualityData()}
                  margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorSatisfaction" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorFollowup" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                  />
                  <YAxis 
                    tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b' }}
                    axisLine={{ stroke: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                    domain={[65, 105]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  
                  <Area 
                    type="monotone" 
                    dataKey="Patient Satisfaction" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorSatisfaction)" 
                  />
                  
                  <Line 
                    type="monotone" 
                    dataKey="Care Completion" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2 }} 
                    activeDot={{ r: 6, strokeWidth: 2 }}
                  />
                  
                  <Line 
                    type="monotone" 
                    dataKey="Follow-up Rate" 
                    stroke="#8b5cf6" 
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2 }} 
                    activeDot={{ r: 6, strokeWidth: 2 }}
                  />
                  
                  <Scatter dataKey="avg" fill="#14b8a6" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Staff Role Distribution */}
          <ChartCard 
            title="Medical Staff Distribution" 
            loading={loading}
            icon={<FiPieChart className="w-5 h-5" />}
            accent="accent"
          >
            <div className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getStaffRolesData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={130}
                    innerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    strokeWidth={3}
                    stroke={isDarkMode ? '#1e293b' : '#ffffff'}
                  >
                    {getStaffRolesData().map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.fill} 
                        fillOpacity={0.9}
                        className="drop-shadow-md"
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [value, name]}
                    contentStyle={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDarkMode ? '#475569' : '#e2e8f0',
                      borderRadius: '0.5rem',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      color: isDarkMode ? '#f8fafc' : '#0f172a'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          
          {/* Recent API Requests */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            whileHover={{ y: -3, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
            className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden hover:shadow-lg transition-all duration-300"
          >
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between bg-gradient-to-r from-gold-50 to-white dark:from-gold-900/20 dark:to-neutral-800">
              <div className="flex items-center">
                <div className="p-2 rounded-lg bg-gold-100 text-gold-600 dark:bg-gold-900/40 dark:text-gold-400 mr-3 shadow-inner">
                  <HiOutlineDocumentReport className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-white font-display tracking-tight">Recent API Requests</h3>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05, x: 2 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-xs font-medium text-gold-600 dark:text-gold-400 flex items-center hover:underline"
                >
                  View All <FiExternalLink className="ml-1 h-3 w-3" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors duration-200"
                >
                  <FiMoreVertical className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-700/30">
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Feature</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Response</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
                  {getHistoryData().slice(0, 5).map((entry, index) => (
                    <motion.tr 
                      key={index} 
                      className="group"
                      whileHover={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)' }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                        {entry.formattedTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200">
                          {entry.friendlyRoute}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          color={
                            entry.method === 'GET' ? 'info' :
                            entry.method === 'POST' ? 'success' :
                            entry.method === 'PUT' ? 'warning' :
                            entry.method === 'DELETE' ? 'error' :
                            'accent'
                          }
                        >
                          {entry.method}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          color={
                            entry.status_code >= 200 && entry.status_code < 300 ? 'success' :
                            entry.status_code >= 400 && entry.status_code < 500 ? 'warning' :
                            entry.status_code >= 500 ? 'error' :
                            'info'
                          }
                        >
                          {entry.status_code}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                        {`${(entry.response_time * 1000).toFixed(2)}ms`}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Active Users Section */}
        <div className="mb-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            whileHover={{ y: -3, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
            className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden hover:shadow-lg transition-all duration-300"
          >
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between bg-gradient-to-r from-primary-50 to-white dark:from-primary-900/20 dark:to-neutral-800">
              <div className="flex items-center">
                <div className="p-2 rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400 mr-3 shadow-inner">
                  <FiUserCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-white font-display tracking-tight">Active Medical Staff</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300 text-xs font-medium px-2.5 py-1 rounded-full">
                  {activeUsers.total} Total Users
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors duration-200"
                >
                  <FiMoreVertical className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
            
            <div className="p-5">
              {loadingUsers ? (
                <div className="space-y-4">
                  <ShimmerLoader className="h-14 w-full" />
                  <ShimmerLoader className="h-14 w-full" />
                  <ShimmerLoader className="h-14 w-full" />
                </div>
              ) : activeUsers.items.length > 0 ? (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-5">
                    {activeUsers.items.slice(0, 5).map((user, index) => (
                      <motion.div 
                        key={user.id || index} 
                        className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700/70"
                        whileHover={{ y: -4, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-secondary-400 dark:from-primary-600 dark:to-secondary-600 p-[2px] shadow-md mb-3">
                            <div className="w-full h-full rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center text-xl font-semibold text-primary-600 dark:text-primary-400">
                              {user.first_name ? user.first_name[0] : (user.username ? user.username[0].toUpperCase() : '?')}
                            </div>
                          </div>
                          <p className="font-medium text-neutral-800 dark:text-white">
                            {user.first_name ? `${user.first_name} ${user.last_name || ''}` : (user.username || 'User')}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 mb-2">
                            {user.email || 'No email provided'}
                          </p>
                          <Badge 
                            color={
                              user.role === 'admin' ? 'accent' :
                              user.role === 'doctor' ? 'info' :
                              user.role === 'cardroom worker' ? 'secondary' :
                              user.role === 'labtechnician' ? 'success' :
                              'neutral'
                            }
                          >
                            {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Pagination - More Premium Styling */}
                  {activeUsers.pages > 1 && (
                    <div className="pt-4 flex items-center justify-between">
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Showing <span className="font-medium text-neutral-700 dark:text-neutral-300">{(currentUserPage - 1) * 5 + 1}-{Math.min(currentUserPage * 5, activeUsers.total)}</span> of <span className="font-medium text-neutral-700 dark:text-neutral-300">{activeUsers.total}</span>
                      </p>
                      <div className="flex items-center space-x-1">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleUserPageChange(Math.max(currentUserPage - 1, 1))}
                          disabled={currentUserPage === 1}
                          className={`p-1.5 rounded-lg ${
                            currentUserPage === 1
                              ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-200'
                          }`}
                          aria-label="Previous page"
                        >
                          <FiChevronLeft className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleUserPageChange(Math.min(currentUserPage + 1, activeUsers.pages))}
                          disabled={currentUserPage === activeUsers.pages}
                          className={`p-1.5 rounded-lg ${
                            currentUserPage === activeUsers.pages
                              ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-200'
                          }`}
                          aria-label="Next page"
                        >
                          <FiChevronRight className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <FiUsers className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">No active users</h3>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    There are currently no active users in the system.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
      
      {/* Premium Footer with Glass Effect */}
      <footer className="mt-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <div className="max-w-7xl mx-auto glass-effect rounded-2xl p-6">

          
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 flex flex-col md:flex-row justify-between items-center">
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">© 2025 MediInsight Analytics. All rights reserved.</p>
            
            <div className="mt-4 md:mt-0 flex items-center space-x-4">
              <motion.a 
                href="#"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
              >
                <span className="sr-only">Twitter</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </motion.a>
              <motion.a 
                href="#"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
              >
                <span className="sr-only">GitHub</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </motion.a>
              <motion.a 
                href="#"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white"
              >
                <span className="sr-only">LinkedIn</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M19.7 3H4.3A1.3 1.3 0 003 4.3v15.4A1.3 1.3 0 004.3 21h15.4a1.3 1.3 0 001.3-1.3V4.3A1.3 1.3 0 0019.7 3zM8.339 18.338H5.667v-8.59h2.672v8.59zM7.004 8.574a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm11.335 9.764H15.67v-4.177c0-.996-.017-2.278-1.387-2.278-1.389 0-1.601 1.086-1.601 2.206v4.249h-2.667v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.779 3.203 4.092v4.711z" clipRule="evenodd" />
                </svg>
              </motion.a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AdminDashboard;
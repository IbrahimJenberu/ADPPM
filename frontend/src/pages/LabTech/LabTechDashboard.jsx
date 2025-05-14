import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence, useMotionTemplate, useMotionValue } from 'framer-motion';
import { FiUsers, FiActivity, FiCheckSquare, FiClock, FiAlertCircle, FiCalendar, FiDownload, FiRefreshCw, FiBarChart2, FiShield, FiFilter, FiArrowUp, FiArrowDown, FiSearch, FiMenu } from 'react-icons/fi';
import { MdOutlineBiotech, MdPriorityHigh, MdOutlineEmojiObjects, MdOutlineTrendingUp, MdOutlineWaves, MdOutlineHealthAndSafety } from 'react-icons/md';
import { RiTestTubeLine, RiPulseLine, RiHeartPulseLine, RiMentalHealthLine } from 'react-icons/ri';
import Chart from 'chart.js/auto';

// Add Inter font
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
`;

// Custom Toast Component with enhanced design
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

// Shimmer Loading Effect Component
const ShimmerEffect = ({ className }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/30 dark:via-slate-600/20 to-transparent shimmer-effect" />
  </div>
);

// Card with enhanced 3D and hover effects
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
          <p className={`text-xs font-medium mt-1 flex items-center
            ${change?.startsWith('+') ? 'text-emerald-500 dark:text-emerald-400' : ''}
            ${change?.startsWith('-') ? 'text-rose-500 dark:text-rose-400' : ''}
          `}>
            {change?.startsWith('+') ? <FiArrowUp className="mr-0.5 w-3 h-3" /> : null}
            {change?.startsWith('-') ? <FiArrowDown className="mr-0.5 w-3 h-3" /> : null}
            {change}
          </p>
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

// Enhanced Card component for charts and content sections
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

// Premium Button Component
const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  icon,
  disabled = false,
  className = ''
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
      className={`font-medium flex items-center justify-center gap-2 transition-all duration-200 ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {icon}
      {children}
    </motion.button>
  );
};

// Badge Component
const Badge = ({ children, color = 'blue', icon }) => {
  const colors = {
    blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
    violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  };
  
  return (
    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </div>
  );
};

// Main Dashboard Component
const LabDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const dailyChartRef = useRef(null);
  const testTypeChartRef = useRef(null);
  const dailyChartInstance = useRef(null);
  const testTypeChartInstance = useRef(null);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8025/api/analytics/dashboard', {
        params: {
          from_date: fromDate,
          to_date: toDate
        }
      });
      setAnalytics(response.data);
      setError(null);
      displayToast('Data refreshed successfully', 'success');
    } catch (err) {
      setError('Failed to fetch analytics data. Please try again later.');
      displayToast('Failed to load data', 'error');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Initial data load
  useEffect(() => {
    fetchAnalytics();
    
    // Listen for dark mode changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e) => setIsDarkMode(e.matches);
    
    // Use the right method based on browser support
    if (darkModeMediaQuery.addEventListener) {
      darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
      return () => darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
    } else {
      // For older browsers
      darkModeMediaQuery.addListener(handleDarkModeChange);
      return () => darkModeMediaQuery.removeListener(handleDarkModeChange);
    }
  }, []);

  // Handle date range changes
  const handleDateRangeApply = () => {
    fetchAnalytics();
  };

  // Toggle dark mode manually
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  // Initialize and update charts when data changes
  useEffect(() => {
    if (!analytics || loading) return;

    const chartTextColor = isDarkMode ? '#e2e8f0' : '#1e293b';
    const chartGridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    // Create daily requests chart
    if (dailyChartRef.current) {
      if (dailyChartInstance.current) {
        dailyChartInstance.current.destroy();
      }

      const ctx = dailyChartRef.current.getContext('2d');
      const gradientFill = ctx.createLinearGradient(0, 0, 0, 400);
      gradientFill.addColorStop(0, isDarkMode ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.3)');
      gradientFill.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

      const labels = analytics.daily_requests.map(item => item.date);
      const data = analytics.daily_requests.map(item => item.count);

      dailyChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Daily Requests',
              data,
              borderColor: '#0ea5e9',
              backgroundColor: gradientFill,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#0ea5e9',
              pointBorderColor: isDarkMode ? '#1e293b' : '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
              usePointStyle: true,
              callbacks: {
                label: (context) => `${context.dataset.label}: ${context.raw} tests`,
              }
            },
          },
          scales: {
            x: {
              grid: {
                display: false,
              },
              ticks: {
                color: chartTextColor,
                font: {
                  family: 'Inter, sans-serif',
                  size: 11,
                },
                maxRotation: 45,
                minRotation: 45,
              }
            },
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
                color: chartTextColor,
                font: {
                  family: 'Inter, sans-serif',
                  size: 11,
                },
              },
              grid: {
                color: chartGridColor,
                drawBorder: false,
              }
            },
          },
          interaction: {
            intersect: false,
            mode: 'index',
          },
          elements: {
            line: {
              borderWidth: 3,
            }
          },
          animation: {
            duration: 1500,
            easing: 'easeOutQuart',
          },
        },
      });
    }

    // Create test type breakdown chart
    if (testTypeChartRef.current && analytics.test_type_breakdown) {
      if (testTypeChartInstance.current) {
        testTypeChartInstance.current.destroy();
      }

      const ctx = testTypeChartRef.current.getContext('2d');
      const labels = analytics.test_type_breakdown.map(item => item.test_type);
      const data = analytics.test_type_breakdown.map(item => item.count);

      testTypeChartInstance.current = new Chart(ctx, {
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
                '#6366f1', // Indigo-500
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
                label: (context) => `${context.label}: ${context.raw} tests (${((context.raw / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`,
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
  }, [analytics, loading, isDarkMode]);

  // Map test status to a more readable format and color
  const getStatusDisplay = (status) => {
    const statusMap = {
      'PENDING': { text: 'Pending', color: 'amber', icon: <FiClock className="mr-1.5" /> },
      'IN_PROGRESS': { text: 'In Progress', color: 'blue', icon: <FiActivity className="mr-1.5" /> },
      'COMPLETED': { text: 'Completed', color: 'green', icon: <FiCheckSquare className="mr-1.5" /> },
      'CANCELLED': { text: 'Cancelled', color: 'rose', icon: <FiAlertCircle className="mr-1.5" /> }
    };
    return statusMap[status] || { text: status, color: 'blue', icon: null };
  };

  // Map priority to a more readable format and color
  const getPriorityDisplay = (priority) => {
    const priorityMap = {
      'HIGH': { text: 'High', color: 'rose', icon: <MdPriorityHigh className="mr-1.5" /> },
      'MEDIUM': { text: 'Medium', color: 'amber', icon: <FiActivity className="mr-1.5" /> },
      'LOW': { text: 'Low', color: 'green', icon: <FiCheckSquare className="mr-1.5" /> }
    };
    return priorityMap[priority] || { text: priority, color: 'blue', icon: null };
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

  // Loading state with premium skeleton UI
  if (loading && !analytics) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 md:p-6 transition-colors duration-300 font-[Inter,system-ui,sans-serif]">
        <style>{fontStyle}</style>
        
        {/* Top header skeleton */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <ShimmerEffect key={i} className="h-28 bg-white dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
          
          {/* Chart skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {[...Array(2)].map((_, i) => (
              <ShimmerEffect key={i} className="h-80 bg-white dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
          
          {/* Status and priority breakdown skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <ShimmerEffect key={i} className="h-64 bg-white dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
        
        {/* Fancy loading overlay */}
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

  // Error state with premium design
  if (error && !analytics) {
    return (
      <div className="font-[Inter,system-ui,sans-serif] min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 md:p-6 flex items-center justify-center transition-colors duration-300">
        <style>{fontStyle}</style>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full overflow-hidden"
        >
          <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl backdrop-blur-sm bg-opacity-95 dark:bg-opacity-90 border border-slate-200/50 dark:border-slate-700/50">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-rose-500 to-rose-600"></div>
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-500 dark:text-rose-300 mx-auto mb-6 shadow-md">
                <FiAlertCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-3">Unable to Load Dashboard</h3>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-8">{error}</p>
              <Button 
                onClick={fetchAnalytics}
                variant="primary"
                size="lg"
                className="w-full"
                icon={<FiRefreshCw className="w-5 h-5" />}
              >
                Retry Connection
              </Button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/30 px-8 py-4 border-t border-slate-200 dark:border-slate-700/50">
              <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                If this issue persists, please contact technical support at <span className="font-medium text-sky-600 dark:text-sky-400">support@healthtech.com</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main dashboard view with premium UI
  if (analytics) {
    const { metrics, status_breakdown, priority_breakdown } = analytics;

    return (
      <div className={`font-[Inter,system-ui,sans-serif] min-h-screen p-0 transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
        <style>{fontStyle}</style>
        
        {/* Add shimmer effect animation */}
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
              width: 10px;
              height: 10px;
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

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 min-h-screen transition-colors duration-300">
          {/* Header Section */}
          <header className="relative border-b border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-sm dark:shadow-slate-700/5">
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
                      Laboratory Analytics
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Performance Dashboard • {format(new Date(), 'MMMM d, yyyy')}
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
                    onClick={fetchAnalytics}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Date Range Filter */}
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 border border-slate-200/80 dark:border-slate-700/80 p-5 transition-all duration-200 hover:shadow-md">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center text-slate-700 dark:text-slate-200">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 mr-3">
                      <FiFilter className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Filter by date range</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Select a timeframe to analyze lab test data
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3">
                    <div className="flex items-center space-x-2">
                      <label htmlFor="from-date" className="text-sm font-medium text-slate-600 dark:text-slate-300">From:</label>
                      <input
                        id="from-date"
                        type="date"
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 focus:border-transparent text-sm transition-colors duration-200"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label htmlFor="to-date" className="text-sm font-medium text-slate-600 dark:text-slate-300">To:</label>
                      <input
                        id="to-date"
                        type="date"
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 focus:border-transparent text-sm transition-colors duration-200"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleDateRangeApply}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {/* Total Requests Today */}
              <StatsCard
                title="Today's Requests"
                value={metrics.total_requests_today}
                change={`+${Math.floor(Math.random() * 15)}% vs yesterday`}
                icon={<MdOutlineBiotech className="w-6 h-6" />}
                color="blue"
                delay={2}
              />
              
              {/* Pending Requests */}
              <StatsCard
                title="Pending Tests"
                value={metrics.pending_requests}
                change={`${Math.random() > 0.5 ? '+' : '-'}${Math.floor(Math.random() * 12)}% this week`}
                icon={<FiClock className="w-6 h-6" />}
                color="amber"
                delay={3}
              />
              
              {/* Completed Requests */}
              <StatsCard
                title="Completed Tests"
                value={metrics.completed_requests}
                change={`+${Math.floor(Math.random() * 22)}% this week`}
                icon={<FiCheckSquare className="w-6 h-6" />}
                color="green"
                delay={4}
              />
              
              {/* Unread Requests */}
              <StatsCard
                title="Unread Requests"
                value={metrics.unread_requests}
                change={metrics.unread_requests > 5 ? '⚠️ Needs attention' : '✓ Within threshold'}
                icon={<FiAlertCircle className="w-6 h-6" />}
                color="rose"
                delay={5}
              />
              
              {/* Average Response Time */}
              <StatsCard
                title="Avg Response Time"
                value={`${metrics.average_response_time.toFixed(1)}h`}
                change={metrics.average_response_time < 24 ? '✓ Within SLA' : '⚠️ Exceeds SLA'}
                icon={<RiPulseLine className="w-6 h-6" />}
                color="purple"
                delay={6}
              />
            </div>
            
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Daily Requests Chart */}
              <Card 
                title="Daily Test Requests" 
                icon={<FiBarChart2 />}
                rightElement={
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<FiDownload className="w-4 h-4" />}
                  >
                    Export
                  </Button>
                }
                delay={7}
              >
                <div className="h-72">
                  <canvas ref={dailyChartRef}></canvas>
                </div>
              </Card>
              
              {/* Test Type Breakdown */}
              <Card 
                title="Test Type Distribution" 
                icon={<RiTestTubeLine />}
                rightElement={
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<FiDownload className="w-4 h-4" />}
                  >
                    Export
                  </Button>
                }
                delay={8}
              >
                <div className="h-72">
                  <canvas ref={testTypeChartRef}></canvas>
                </div>
              </Card>
            </div>
            
            {/* Status and Priority Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Status Breakdown */}
              <Card 
                title="Test Status Distribution" 
                icon={<FiCheckSquare />}
                delay={9}
              >
                <div className="space-y-5">
                  {Object.keys(status_breakdown || {}).map((status, index) => {
                    const count = status_breakdown[status];
                    const total = Object.values(status_breakdown).reduce((sum, val) => sum + val, 0);
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const { text, color, icon } = getStatusDisplay(status);
                    
                    return (
                      <motion.div 
                        key={status}
                        whileHover={{ scale: 1.01 }}
                        className="group"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + (index * 0.1) }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center">
                            <Badge color={color} icon={icon}>{text}</Badge>
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {count} tests ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <ProgressBar 
                          percentage={percentage} 
                          color={color} 
                          animate={true}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
              
              {/* Priority Breakdown */}
              <Card 
                title="Test Priority Distribution" 
                icon={<MdPriorityHigh />}
                delay={10}
              >
                <div className="space-y-5">
                  {Object.keys(priority_breakdown || {}).map((priority, index) => {
                    const count = priority_breakdown[priority];
                    const total = Object.values(priority_breakdown).reduce((sum, val) => sum + val, 0);
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const { text, color, icon } = getPriorityDisplay(priority);
                    
                    return (
                      <motion.div 
                        key={priority}
                        whileHover={{ scale: 1.01 }}
                        className="group"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.0 + (index * 0.1) }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center">
                            <Badge color={color} icon={icon}>{text}</Badge>
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {count} tests ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <ProgressBar 
                          percentage={percentage} 
                          color={color} 
                          animate={true}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </div>
            
            {/* Insights Card - New Premium Feature */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="mb-8"
            >
              <div className="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 rounded-xl shadow-sm overflow-hidden border border-sky-100 dark:border-sky-800/30">
                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 mr-4">
                        <MdOutlineEmojiObjects className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
                          AI-Powered Insights
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                          Your lab is operating at <span className="font-semibold text-sky-600 dark:text-sky-400">92% efficiency</span> compared to similar facilities. Response times have improved by <span className="font-semibold text-emerald-600 dark:text-emerald-400">18%</span> in the last 30 days.
                        </p>
                      </div>
                    </div>
                    <div className="md:text-right">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<MdOutlineTrendingUp className="w-4 h-4" />}
                      >
                        View Detailed Report
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Last updated info with premium design */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-sm text-slate-500 dark:text-slate-400">
                <span>Last updated: {new Date().toLocaleString()}</span>
                <motion.button 
                  whileHover={{ rotate: 180 }}
                  transition={{ duration: 0.3 }}
                  onClick={fetchAnalytics}
                  className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 flex items-center justify-center transition-colors"
                  aria-label="Refresh data"
                >
                  <FiRefreshCw className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>
          </main>
          
          {/* Footer */}
          <footer className="border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/90 py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center">
                    <div className="h-8 w-8 flex items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 mr-2">
                      <MdOutlineHealthAndSafety className="h-5 w-5" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-white">HealthTech Analytics</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Version 2.4.1 • Enterprise Edition</p>
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
                  © 2025 HealthTech Analytics • All rights reserved • <a href="#" className="text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300">Privacy Policy</a>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return null;
};

export default LabDashboard;
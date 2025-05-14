import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  FaWifi, FaTimes, FaExclamationTriangle, FaSpinner, FaCheckCircle, 
  FaClipboard, FaCalendarAlt, FaUser, FaChevronDown, FaChevronRight, 
  FaExclamationCircle, FaArrowLeft, FaArrowRight, FaList, FaFlask,
  FaSortAmountDown, FaSortAmountUp, FaSearch, FaBell, FaEye,
  FaClock, FaHistory, FaUserMd, FaExternalLinkAlt, FaEllipsisH
} from 'react-icons/fa';
import { useAuth } from "../../contexts/AuthContext";
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { format, parseISO, differenceInDays } from 'date-fns';

// Load custom fonts
const fontCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
`;

// Notification Sound Component
const NotificationSound = () => {
  const audioRef = useRef(null);
  
  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error('Error playing notification sound:', e));
    }
  }, []);

  // Expose the play method to parent components
  useEffect(() => {
    window.playNotificationSound = playSound;
  }, [playSound]);

  return (
    <audio 
      ref={audioRef} 
      src="https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg" 
      preload="auto"
    />
  );
};

// Popup Notification Component
const NotificationPopup = ({ message, onClose, isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-6 right-6 max-w-md z-50"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-indigo-100/50 dark:border-indigo-900/30">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 px-4 flex justify-between items-center">
              <h3 className="text-white font-semibold flex items-center">
                <div className="bg-white/20 rounded-full p-1 mr-2.5">
                  <FaFlask className="text-white text-sm" />
                </div>
                New Lab Result
              </h3>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-all"
                aria-label="Close notification"
              >
                <FaTimes className="text-xs" />
              </motion.button>
            </div>
            <div className="p-4">
              <p className="text-gray-700 dark:text-gray-300 font-medium">{message}</p>
              <div className="mt-4 flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg shadow-md shadow-indigo-500/20 dark:shadow-indigo-800/20 font-medium flex items-center"
                >
                  <span>View Result</span>
                  <FaExternalLinkAlt className="ml-2 text-xs" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Error caught by boundary:", error);
    console.error("Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/10 dark:to-red-800/5 rounded-xl shadow-xl text-center backdrop-blur-sm"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 mb-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 dark:text-red-400">
            <FaExclamationTriangle className="text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">
            Something went wrong
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            We encountered an error while loading your lab results. Our team has been notified and is looking into this issue.
          </p>
          <motion.button
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 dark:shadow-indigo-800/20 transition-all"
            aria-label="Try again"
          >
            Try again
          </motion.button>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

// Status Badge Component
const StatusBadge = ({ status }) => {
  const getStatusStyles = () => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/50';
      case 'rejected':
        return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/50';
    }
  };

  const getStatusLabel = () => {
    if (!status) return 'Unknown';
    
    // Convert snake_case to Title Case and replace underscores with spaces
    return status.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusIcon = () => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return <FaClock className="mr-1.5" />;
      case 'in_progress':
        return <FaSpinner className="mr-1.5 animate-spin" />;
      case 'completed':
        return <FaCheckCircle className="mr-1.5" />;
      case 'cancelled':
        return <FaTimes className="mr-1.5" />;
      case 'rejected':
        return <FaExclamationCircle className="mr-1.5" />;
      default:
        return <FaEllipsisH className="mr-1.5" />;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${getStatusStyles()}`}>
      {getStatusIcon()}
      {getStatusLabel()}
    </span>
  );
};

// Urgency Badge Component
const UrgencyBadge = ({ urgency }) => {
  const getUrgencyStyles = () => {
    switch (urgency?.toLowerCase()) {
      case 'stat':
        return 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50';
      case 'urgent':
        return 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50';
      case 'routine':
        return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/50';
    }
  };

  const getUrgencyIcon = () => {
    switch (urgency?.toLowerCase()) {
      case 'stat':
        return <FaExclamationCircle className="mr-1.5" />;
      case 'urgent':
        return <FaExclamationTriangle className="mr-1.5" />;
      case 'routine':
        return <FaClipboard className="mr-1.5" />;
      default:
        return <FaEllipsisH className="mr-1.5" />;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${getUrgencyStyles()}`}>
      {getUrgencyIcon()}
      {urgency ? urgency.charAt(0).toUpperCase() + urgency.slice(1) : 'Unknown'}
    </span>
  );
};

// Parameter Card Component
const ParameterCard = React.memo(({ paramName, paramData, isAbnormal }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div 
      whileHover={{ translateY: -2, boxShadow: "0 6px 12px rgba(0, 0, 0, 0.05)" }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl mb-3 overflow-hidden border transition-all ${
        isAbnormal 
          ? 'border-red-200 dark:border-red-800/50 shadow-sm' 
          : 'border-slate-100 dark:border-slate-800/60 shadow-sm'
      }`}
    >
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex justify-between items-center p-4 cursor-pointer transition-colors ${
          isAbnormal 
            ? 'bg-red-50/70 dark:bg-red-900/10' 
            : 'bg-white dark:bg-slate-800/50'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-1.5 h-14 rounded-full ${
            isAbnormal 
              ? 'bg-gradient-to-b from-red-400 to-red-600 dark:from-red-500 dark:to-red-700' 
              : 'bg-gradient-to-b from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700'
          }`}></div>
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center text-sm">
              {paramName}
              {isAbnormal && (
                <span className="ml-2 text-red-500 animate-pulse" title="Abnormal result">
                  <FaExclamationCircle size={14} />
                </span>
              )}
            </h4>
            <div className="flex items-baseline mt-2">
              <span className={`text-2xl font-bold ${
                isAbnormal 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-slate-800 dark:text-slate-200'
              }`}>
                {paramData?.value || 'N/A'}
              </span>
              {paramData?.unit && (
                <span className="ml-1.5 text-sm text-slate-500 dark:text-slate-400">
                  {paramData.unit}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center">
          {paramData?.normal_range && (
            <span className={`px-2.5 py-1 rounded-full text-xs mr-3 ${
              isAbnormal 
                ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40' 
                : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
            }`}>
              {isAbnormal ? `Below normal (≥${paramData.normal_range})` : `Normal range (≥${paramData.normal_range})`}
            </span>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2, type: "tween" }}
            className="bg-slate-100 dark:bg-slate-700 rounded-full p-1.5"
          >
            <FaChevronDown className="text-slate-500 dark:text-slate-400 text-xs" />
          </motion.div>
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-800/30"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {paramData?.recorded_at && (
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mr-3 text-blue-600 dark:text-blue-400">
                    <FaCalendarAlt size={14} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Recorded Date</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      {new Date(paramData.recorded_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {paramData?.recorded_by && (
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mr-3 text-purple-600 dark:text-purple-400">
                    <FaUserMd size={14} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Recorded By</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      ID: {typeof paramData.recorded_by === 'string' && paramData.recorded_by.length > 12 
                        ? `${paramData.recorded_by.substring(0, 8)}...` 
                        : paramData.recorded_by || 'Unknown'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// Recent Result Card Component
const RecentResultCard = ({ result, onViewDetails }) => {
  if (!result || typeof result !== 'object') return null;
  
  // Get all parameters in this result
  const paramNames = Object.keys(result.result_data || {});
  
  // Determine if any parameter is abnormal
  let hasAbnormalParams = false;
  paramNames.forEach(paramName => {
    const paramData = result.result_data[paramName];
    const value = parseFloat(paramData?.value);
    const normalRange = parseFloat(paramData?.normal_range);
    if (!isNaN(value) && !isNaN(normalRange) && value < normalRange) {
      hasAbnormalParams = true;
    }
  });
  
  // Get time since
  const getTimeSince = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffSeconds = Math.floor((now - date) / 1000);
      
      if (diffSeconds < 60) return `${diffSeconds}s ago`;
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
      if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
      if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)}d ago`;
      
      return format(date, 'MMM d');
    } catch (e) {
      return '';
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={() => onViewDetails(result)}
      className={`min-w-[300px] w-[300px] rounded-xl overflow-hidden shadow-md hover:shadow-xl cursor-pointer transition-all duration-300 border ${
        hasAbnormalParams 
          ? 'border-red-200 dark:border-red-800/50 bg-gradient-to-br from-white to-red-50 dark:from-slate-800 dark:to-red-900/10' 
          : result.acknowledged 
            ? 'border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800'
            : 'border-blue-200 dark:border-blue-800/50 bg-gradient-to-br from-white to-blue-50 dark:from-slate-800 dark:to-blue-900/10'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            <div className={`rounded-lg p-2 mr-3 ${
              hasAbnormalParams 
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            }`}>
              <FaFlask size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                {result.test_type 
                  ? result.test_type.replace(/_/g, ' ') 
                  : 'Lab Test'
                }
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ID: {(result.id || '').substring(0, 8)}...
              </p>
            </div>
          </div>
          {!result.acknowledged && (
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full mr-1 animate-pulse"></span>
              New
            </span>
          )}
        </div>
        
        {result.created_at && (
          <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mb-4">
            <FaCalendarAlt className="mr-1.5" /> 
            {getTimeSince(result.created_at)}
          </div>
        )}
        
        <div className="space-y-3 mt-4">
          {/* Show top 2 parameters only for the card */}
          {paramNames.slice(0, 2).map(paramName => {
            const paramData = result.result_data[paramName];
            const value = parseFloat(paramData?.value);
            const normalRange = parseFloat(paramData?.normal_range);
            const isAbnormal = !isNaN(value) && !isNaN(normalRange) && value < normalRange;
            
            return (
              <div 
                key={paramName}
                className={`p-3 rounded-lg ${
                  isAbnormal
                    ? 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30'
                    : 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30'
                }`}
              >
                <div className="flex justify-between items-start">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-1 max-w-[140px]">
                    {paramName}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    isAbnormal
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {isAbnormal ? 'Abnormal' : 'Normal'}
                  </span>
                </div>
                <div className="flex items-baseline mt-1">
                  <span className={`text-lg font-bold ${
                    isAbnormal 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {paramData?.value || 'N/A'}
                  </span>
                  {paramData?.unit && (
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                      {paramData.unit}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          {paramNames.length > 2 && (
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
              + {paramNames.length - 2} more parameters
            </p>
          )}
        </div>
        
        <div className="flex justify-end mt-4">
          <button 
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-xs flex items-center font-medium"
          >
            View Details 
            <FaExternalLinkAlt className="ml-1.5 text-[10px]" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Notification Item Component
const NotificationItem = ({ notification, onViewDetails, onDismiss }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`border-b dark:border-slate-700/60 last:border-b-0 p-4 ${
        notification.read 
          ? 'bg-white dark:bg-slate-800'
          : 'bg-blue-50/70 dark:bg-blue-900/10'
      }`}
    >
      <div className="flex items-start">
        <div className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full mr-3 ${
          notification.read 
            ? 'bg-slate-300 dark:bg-slate-600' 
            : 'bg-blue-500 dark:bg-blue-400 animate-pulse'
        }`}></div>
        <div className="flex-grow">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {notification.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {notification.time}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onViewDetails(notification)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center font-medium"
            >
              <FaEye className="mr-1.5" size={12} /> View Details
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main Lab Results Component
function LabResultsWS() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [labResults, setLabResults] = useState([]);
  const [expandedResults, setExpandedResults] = useState({});
  
  // New state for lab requests view
  const [activeView, setActiveView] = useState('requests'); // 'requests' or 'results'
  const [labRequests, setLabRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    total: 0,
    skip: 0,
    limit: 10
  });
  
  // Sorting and filtering state
  const [sorting, setSorting] = useState({
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  
  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPopupNotification, setShowPopupNotification] = useState(false);
  const [currentPopupMessage, setCurrentPopupMessage] = useState('');
  
  // Recent results state
  const [isScrollable, setIsScrollable] = useState(false);
  const recentResultsRef = useRef(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const notificationsRef = useRef(null);
  
  // Check if horizontal scroll is needed for recent results
  useEffect(() => {
    const checkScrollable = () => {
      if (recentResultsRef.current) {
        setIsScrollable(
          recentResultsRef.current.scrollWidth > recentResultsRef.current.clientWidth
        );
      }
    };
    
    checkScrollable();
    window.addEventListener('resize', checkScrollable);
    
    return () => {
      window.removeEventListener('resize', checkScrollable);
    };
  }, [labResults]);
  
  useEffect(() => {
    // Close notifications dropdown when clicking outside
    function handleClickOutside(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Update unread count when notifications change
  useEffect(() => {
    const count = notifications.filter(notification => !notification.read).length;
    setUnreadCount(count);
  }, [notifications]);
  
  const addNotification = useCallback((labResult) => {
    // Create a notification from lab result
    const testType = labResult.test_type || 'Lab Test';
    const paramCount = Object.keys(labResult.result_data || {}).length;
    const hasAbnormal = Object.entries(labResult.result_data || {}).some(([_, paramData]) => {
      const value = parseFloat(paramData?.value);
      const normalRange = parseFloat(paramData?.normal_range);
      return !isNaN(value) && !isNaN(normalRange) && value < normalRange;
    });
    
    const title = `New ${testType} Result`;
    const message = hasAbnormal
      ? `Abnormal values detected in ${paramCount} parameter(s)`
      : `${paramCount} parameter(s) within normal range`;
    
    const newNotification = {
      id: labResult.lab_result_id || labResult.id || `notification-${Date.now()}`,
      title,
      message,
      time: new Date().toLocaleTimeString(),
      timestamp: new Date(),
      read: false,
      labResultId: labResult.lab_result_id || labResult.id,
      labRequestId: labResult.lab_request_id
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show popup notification
    setCurrentPopupMessage(`${title}: ${message}`);
    setShowPopupNotification(true);
    
    // Play notification sound if function exists
    if (window.playNotificationSound) {
      window.playNotificationSound();
    }
    
    return newNotification;
  }, []);
  
  const markNotificationAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      )
    );
  }, []);
  
  const handleViewNotificationDetails = useCallback((notification) => {
    // Mark as read
    markNotificationAsRead(notification.id);
    
    // Close notification panel
    setShowNotifications(false);
    
    // Find the lab request for this result
    if (notification.labRequestId) {
      // Find the request in our existing requests
      const request = labRequests.find(req => req.id === notification.labRequestId);
      
      if (request) {
        setSelectedRequest(request);
        setActiveView('results');
      } else {
        // If we don't have the request loaded, try to fetch it or its results
        fetchLabResultsByRequestId(notification.labRequestId);
      }
    }
  }, [labRequests]);
  
  const toggleResultExpanded = (resultId) => {
    setExpandedResults(prev => ({
      ...prev,
      [resultId]: !prev[resultId]
    }));
  };
  
  // Toggle sort order
  const toggleSortOrder = () => {
    setSorting(prev => ({
      ...prev,
      sort_order: prev.sort_order === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Change sort field
  const changeSortBy = (field) => {
    setSorting(prev => ({
      ...prev,
      sort_by: field
    }));
  };
  
  // Format date string
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateString;
    }
  };
  
  // Fetch lab requests from backend
  const fetchLabRequests = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingRequests(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams();
      
      // Add pagination params
      queryParams.append('skip', pagination.skip);
      queryParams.append('limit', pagination.limit);
      
      // Add doctor_id (required)
      queryParams.append('doctor_id', user.id);
      
      // Add sorting params
      queryParams.append('sort_by', sorting.sort_by);
      queryParams.append('sort_order', sorting.sort_order);
      
      const response = await axios.get(`http://localhost:8024/lab-requests?${queryParams.toString()}`);
      
      if (response.data.success) {
        setLabRequests(response.data.lab_requests);
        setPagination(prev => ({
          ...prev,
          total: response.data.total
        }));
        toast.success('Lab requests loaded successfully');
      } else {
        throw new Error(response.data.detail || 'Failed to fetch lab requests');
      }
    } catch (err) {
      console.error('Error fetching lab requests:', err);
      setError(err.message || 'Failed to fetch lab requests. Please try again.');
      toast.error('Failed to fetch lab requests');
    } finally {
      setIsLoadingRequests(false);
    }
  }, [user, pagination.skip, pagination.limit, sorting.sort_by, sorting.sort_order]);
  
  // Fetch lab results for a specific request
  const fetchLabResultsByRequestId = useCallback(async (requestId) => {
    if (!requestId) return;
    
    setIsLoadingResults(true);
    setError(null);
    
    try {
      const response = await axios.get(`http://localhost:8024/lab-results/by-request/${requestId}`);
      
      if (response.data) {
        // Process the lab results data
        const results = response.data.results || [];
        
        // Update lab results but preserve any WebSocket results that might be for this request
        setLabResults(prevResults => {
          // Keep only results that don't belong to this request
          const otherResults = prevResults.filter(r => r.lab_request_id !== requestId);
          // Add new results from API
          return [...results, ...otherResults];
        });
        
        setSelectedRequest(response.data.lab_request || { id: requestId });
        setActiveView('results');
        toast.success('Lab results loaded successfully');
      } else {
        throw new Error('No lab results found for this request');
      }
    } catch (err) {
      console.error('Error fetching lab results:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch lab results';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingResults(false);
    }
  }, []);
  
  // Handle page change for pagination
  const handlePageChange = (newSkip) => {
    setPagination(prev => ({
      ...prev,
      skip: newSkip
    }));
  };
  
  // Create WebSocket URL with proper protocol and token
  const getWebSocketUrl = useCallback(() => {
    if (!user?.id) return null;
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' ? `${window.location.hostname}:8024` : window.location.host;
    
    const tokenParam = user?.token ? `?token=${encodeURIComponent(user.token)}` : '';
    
    return `${protocol}://${host}/ws/lab-results/${user.id}${tokenParam}`;
  }, [user]);
  
  // RESTORED ORIGINAL WEBSOCKET CONNECTION LOGIC
  // Connect to WebSocket
  const connect = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    if (!wsUrl || isConnecting) return;
    
    console.log("Connecting to WebSocket:", wsUrl);
    setIsConnecting(true);
    setError(null);
    
    // Clean up existing connection if any
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        if (wsRef.current.readyState === WebSocket.OPEN || 
            wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch (err) {
        console.error("Error closing existing WebSocket:", err);
      }
    }
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log("WebSocket connection established!");
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        
        // Setup ping interval to keep connection alive
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send(JSON.stringify({ type: "ping" }));
            } catch (err) {
              console.error("Error sending ping:", err);
            }
          }
        }, 20000);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          console.log("WebSocket message received:", event.data);
          const data = JSON.parse(event.data);
          
          // Handle lab_result_ready messages with data inside a "data" property
          if (data.type === 'lab_result_ready' && data.data) {
            // Add the new lab result to the list
            const processedResult = processLabResult(data.data);
            
            // Add notification for the new result
            addNotification(processedResult);
            
            toast.success('New lab result received', {
              icon: '🧪',
              duration: 5000,
            });
            // Refresh lab requests list as a status might have changed
            fetchLabRequests();
          }
          // Handle direct lab result data (if structure changes)
          else if (data.lab_request_id && data.result_data) {
            const processedResult = processLabResult(data);
            
            // Add notification
            addNotification(processedResult);
            
            toast.success('New lab result received', {
              icon: '🧪',
              duration: 5000,
            });
            fetchLabRequests();
          }
          // Handle notification messages
          else if (data.type === 'notification' && data.data?.notification_type === 'lab_result_ready') {
            // Process lab result notification
            processLabResultNotification(data.data);
          }
          // Handle acknowledge_success messages
          else if (data.type === 'acknowledge_success') {
            updateAcknowledgedResult(data.result_id);
            toast.success('Result acknowledged successfully', {
              icon: '✅',
              duration: 3000,
            });
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };
      
      wsRef.current.onclose = (event) => {
        console.log("WebSocket connection closed. Code:", event.code, "Reason:", event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Try to reconnect if it wasn't a clean close
        if (event.code !== 1000) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 30000);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
      
      wsRef.current.onerror = (event) => {
        console.error("WebSocket error:", event);
        setIsConnecting(false);
      };
    } catch (err) {
      console.error("Error establishing WebSocket connection:", err);
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [getWebSocketUrl, isConnecting, fetchLabRequests, addNotification]);
  
  // Process lab result notification
  const processLabResultNotification = useCallback((notification) => {
    console.log("Processing lab result notification:", notification);
    
    // If notification already contains full lab result data, process directly
    if (notification.lab_request_id && notification.result_data) {
      processLabResult(notification);
      return;
    }
    
    // Otherwise handle the notification by id
    if (!notification || !notification.entity_id) {
      console.error("Invalid notification format", notification);
      return;
    }
    
    // For demo purposes, you might make an API call to fetch the full result
    // For now, simulate receiving the result after a short delay
    setTimeout(() => {
      const mockResult = {
        lab_request_id: notification.entity_id,
        lab_result_id: notification.id || `temp-${Date.now()}`,
        result_data: {
          [`Test for ${notification.message?.split(':')[1]?.trim() || 'unknown'}`]: {
            unit: "mg",
            value: Math.floor(Math.random() * 100).toString(),
            recorded_at: new Date().toISOString(),
            recorded_by: "system",
            normal_range: "80"
          }
        },
        conclusion: notification.message || "New result received",
        image_paths: [],
        created_at: notification.created_at || new Date().toISOString()
      };
      
      const processedResult = processLabResult(mockResult);
      
      // Add notification
      addNotification(processedResult);
    }, 500);
  }, [addNotification]);
  
  // Process a complete lab result - this processes both WebSocket and API results
  const processLabResult = useCallback((labResult) => {
    if (!labResult) {
      console.error("Invalid lab result data: null or undefined");
      return null;
    }

    // Use lab_result_id as the unique identifier (not id)
    const resultId = labResult.lab_result_id || labResult.id;
    
    if (!resultId) {
      console.error("Invalid lab result data: missing lab_result_id or id", labResult);
      return null;
    }

    if (!labResult.result_data || typeof labResult.result_data !== 'object') {
      console.error("Invalid lab result data: missing or invalid result_data", labResult);
      return null;
    }
    
    console.log("Processing complete lab result:", labResult);
    
    const processedResult = { ...labResult, id: resultId };
    
    setLabResults(prev => {
      // Check if the result already exists (using lab_result_id or fallback to id)
      if (prev.some(r => (r.lab_result_id === resultId) || (r.id === resultId))) {
        // Update the existing result in case there are changes
        return prev.map(r => (r.lab_result_id === resultId || r.id === resultId) ? 
          { ...r, ...labResult, id: r.id || resultId } : r);
      }
      
      // Add new result at the beginning of the array
      // Ensure it has an id property for component keys
      return [{ ...labResult, id: resultId }, ...prev];
    });
    
    // If the result is for the currently selected request, update the view to show it
    if (selectedRequest && labResult.lab_request_id === selectedRequest.id) {
      setActiveView('results');
    }
    
    return processedResult;
  }, [selectedRequest]);
  
  // Update acknowledged result
  const updateAcknowledgedResult = useCallback((resultId) => {
    if (!resultId) return;
    
    setLabResults(prev => 
      prev.map(result => 
        (result.id === resultId || result.lab_result_id === resultId)
          ? { ...result, acknowledged: true } 
          : result
      )
    );
  }, []);
  
  // Extract all parameter names from result data
  const getParameterNames = useCallback((resultData) => {
    if (!resultData || typeof resultData !== 'object') return [];
    return Object.keys(resultData);
  }, []);
  
  // Check if value is abnormal (below normal range)
  const isAbnormalValue = useCallback((value, normalRange) => {
    if (value === undefined || value === null || normalRange === undefined || normalRange === null) return false;
    
    // Try to parse as numbers for comparison
    const numValue = parseFloat(value);
    const numRange = parseFloat(normalRange);
    
    if (isNaN(numValue) || isNaN(numRange)) {
      // If not parseable as numbers, do string comparison
      return String(value) < String(normalRange);
    }
    
    return numValue < numRange;
  }, []);
  
  // Acknowledge a lab result
  const acknowledgeResult = useCallback((resultId) => {
    if (!isConnected || !wsRef.current) {
      toast.error('Cannot acknowledge: Not connected to server');
      setError("Cannot acknowledge: Not connected to server");
      return;
    }
    
    try {
      wsRef.current.send(JSON.stringify({
        type: 'acknowledge_result',
        result_id: resultId
      }));
      
      // Update UI optimistically
      updateAcknowledgedResult(resultId);
    } catch (err) {
      console.error("Error acknowledging result:", err);
      toast.error(`Failed to acknowledge: ${err.message}`);
      setError(`Failed to acknowledge result: ${err.message}`);
    }
  }, [isConnected, updateAcknowledgedResult]);
  
  // Calculate time since timestamp
  const getTimeSince = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffSeconds = Math.floor((now - date) / 1000);
      
      if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutes ago`;
      if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
      
      const days = differenceInDays(now, date);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      
      return format(date, 'MMM d, yyyy');
    } catch (e) {
      console.error("Error formatting time:", e);
      return '';
    }
  }, []);
  
  // Connect to WebSocket when component mounts
  useEffect(() => {
    if (user?.id) {
      connect();
    }
    
    return () => {
      // Clean up on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, user]);
  
  // Fetch lab requests on component mount and when pagination/sorting changes
  useEffect(() => {
    if (user?.id) {
      fetchLabRequests();
    }
  }, [fetchLabRequests, user, pagination.skip, pagination.limit, sorting.sort_by, sorting.sort_order]);
  
  // Filter lab results for the selected request when in results view
  const filteredLabResults = useCallback(() => {
    if (!selectedRequest) return labResults;
    
    // Filter lab results for the specific request
    return labResults.filter(result => 
      result.lab_request_id === selectedRequest.id
    );
  }, [labResults, selectedRequest]);
  
  // Save lab results to localStorage for persistence
  useEffect(() => {
    if (labResults.length > 0) {
      try {
        localStorage.setItem('labResults', JSON.stringify(labResults));
      } catch (e) {
        console.error("Error saving lab results:", e);
      }
    }
  }, [labResults]);
  
  // Load lab results from localStorage on first render
  useEffect(() => {
    try {
      const savedResults = localStorage.getItem('labResults');
      if (savedResults) {
        const parsed = JSON.parse(savedResults);
        if (Array.isArray(parsed)) {
          setLabResults(parsed);
        }
      }
    } catch (e) {
      console.error("Error loading lab results:", e);
    }
  }, []);

  // Handle view recent result
  const handleViewRecentResult = useCallback((result) => {
    // Find the request corresponding to this result
    const requestId = result.lab_request_id;
    if (!requestId) return;
    
    // Look for the request in our loaded requests
    const request = labRequests.find(req => req.id === requestId);
    
    if (request) {
      setSelectedRequest(request);
      setActiveView('results');
      
      // Expand this result
      toggleResultExpanded(result.id || result.lab_result_id);
    } else {
      // If not found, fetch the request and results
      fetchLabResultsByRequestId(requestId);
    }
  }, [labRequests, fetchLabResultsByRequestId]);

  // Render recent lab results
  const renderRecentResults = useCallback(() => {
    // Get only the 10 most recent results
    const recentResults = [...labResults]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 10);
    
    if (recentResults.length === 0) {
      return (
        <div className="flex items-center justify-center h-40 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <FaHistory className="text-slate-400 dark:text-slate-500 text-xl" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">No recent results found</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 max-w-xs">
              New lab results will appear here when they become available
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div 
        ref={recentResultsRef}
        className="flex space-x-4 overflow-x-auto pb-4 pt-1 px-1 -mx-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {recentResults.map(result => (
          <RecentResultCard 
            key={result.id || result.lab_result_id} 
            result={result}
            onViewDetails={() => handleViewRecentResult(result)}
          />
        ))}
      </div>
    );
  }, [labResults, handleViewRecentResult]);

  // Render lab requests list
  const renderLabRequestsList = () => {
    if (isLoadingRequests) {
      return (
        <div className="flex justify-center items-center py-20">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 dark:border-t-indigo-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FaSpinner className="text-indigo-500 dark:text-indigo-400 text-sm animate-pulse" />
              </div>
            </div>
            <span className="mt-4 text-slate-600 dark:text-slate-400 text-sm font-medium">Loading lab requests...</span>
          </div>
        </div>
      );
    }

    if (!Array.isArray(labRequests) || labRequests.length === 0) {
      return (
        <div className="py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <FaClipboard className="text-slate-400 dark:text-slate-500 text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No lab requests found</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">
            There are no lab requests to display at this time. New test requests will appear here once they are ordered.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/70">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  onClick={() => changeSortBy('test_type')}
                >
                  <div className="flex items-center cursor-pointer group">
                    Test Type
                    {sorting.sort_by === 'test_type' && (
                      <span className="ml-1.5 text-indigo-500 dark:text-indigo-400">
                        {sorting.sort_order === 'asc' ? (
                          <FaSortAmountUp size={12} />
                        ) : (
                          <FaSortAmountDown size={12} />
                        )}
                      </span>
                    )}
                    {sorting.sort_by !== 'test_type' && (
                      <span className="ml-1.5 opacity-0 group-hover:opacity-50">
                        <FaSortAmountDown className="text-slate-400 dark:text-slate-500" size={12} />
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                >
                  Patient
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  onClick={() => changeSortBy('status')}
                >
                  <div className="flex items-center cursor-pointer group">
                    Status
                    {sorting.sort_by === 'status' && (
                      <span className="ml-1.5 text-indigo-500 dark:text-indigo-400">
                        {sorting.sort_order === 'asc' ? (
                          <FaSortAmountUp size={12} />
                        ) : (
                          <FaSortAmountDown size={12} />
                        )}
                      </span>
                    )}
                    {sorting.sort_by !== 'status' && (
                      <span className="ml-1.5 opacity-0 group-hover:opacity-50">
                        <FaSortAmountDown className="text-slate-400 dark:text-slate-500" size={12} />
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  onClick={() => changeSortBy('urgency')}
                >
                  <div className="flex items-center cursor-pointer group">
                    Urgency
                    {sorting.sort_by === 'urgency' && (
                      <span className="ml-1.5 text-indigo-500 dark:text-indigo-400">
                        {sorting.sort_order === 'asc' ? (
                          <FaSortAmountUp size={12} />
                        ) : (
                          <FaSortAmountDown size={12} />
                        )}
                      </span>
                    )}
                    {sorting.sort_by !== 'urgency' && (
                      <span className="ml-1.5 opacity-0 group-hover:opacity-50">
                        <FaSortAmountDown className="text-slate-400 dark:text-slate-500" size={12} />
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  onClick={() => changeSortBy('created_at')}
                >
                  <div className="flex items-center cursor-pointer group">
                    Date
                    {sorting.sort_by === 'created_at' && (
                      <span className="ml-1.5 text-indigo-500 dark:text-indigo-400">
                        {sorting.sort_order === 'asc' ? (
                          <FaSortAmountUp size={12} />
                        ) : (
                          <FaSortAmountDown size={12} />
                        )}
                      </span>
                    )}
                    {sorting.sort_by !== 'created_at' && (
                      <span className="ml-1.5 opacity-0 group-hover:opacity-50">
                        <FaSortAmountDown className="text-slate-400 dark:text-slate-500" size={12} />
                      </span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-slate-200 dark:divide-slate-700/60">
              {labRequests.map((request) => (
                <motion.tr 
                  key={request.id}
                  whileHover={{ backgroundColor: 'rgba(249, 250, 251, 0.7)', scaleX: 1.003 }}
                  transition={{ duration: 0.2 }}
                  className="group hover:bg-slate-50 dark:hover:bg-slate-750 transition-all"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{request.test_type}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">ID: {request.id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{request.patient_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <UrgencyBadge urgency={request.urgency} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(request.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedRequest(request);
                        
                        // First check if we already have results via WebSocket
                        const existingResults = labResults.filter(r => 
                          r.lab_request_id === request.id
                        );
                        
                        if (existingResults.length > 0) {
                          // If we already have results via WebSocket, just switch to results view
                          setActiveView('results');
                          toast.success('Showing existing lab results');
                        } else if (request.status === 'completed') {
                          // Otherwise fetch from API if completed
                          fetchLabResultsByRequestId(request.id);
                        } else {
                          // If not completed, just show the results view (which will be empty)
                          setActiveView('results');
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-200 dark:shadow-indigo-900/20 font-medium text-xs"
                      title={request.status === 'completed' 
                        ? "View lab results" 
                        : "Results not available yet"}
                    >
                      View Results
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="py-5 flex items-center justify-between border-t border-slate-200 dark:border-slate-700/50 mt-4">
            <div className="flex-1 flex justify-between sm:hidden">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePageChange(Math.max(0, pagination.skip - pagination.limit))}
                disabled={pagination.skip === 0}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg shadow-sm ${
                  pagination.skip === 0
                    ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-650'
                }`}
              >
                Previous
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePageChange(pagination.skip + pagination.limit)}
                disabled={pagination.skip + pagination.limit >= pagination.total}
                className={`ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg shadow-sm ${
                  pagination.skip + pagination.limit >= pagination.total
                    ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-650'
                }`}
              >
                Next
              </motion.button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Showing <span className="font-medium">{pagination.skip + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.skip + pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePageChange(Math.max(0, pagination.skip - pagination.limit))}
                    disabled={pagination.skip === 0}
                    className={`relative inline-flex items-center px-3 py-2 rounded-l-lg border text-sm font-medium ${
                      pagination.skip === 0
                        ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                        : 'text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-650'
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <FaArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </motion.button>
                  
                  {/* Page numbers would go here if needed */}
                  
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePageChange(pagination.skip + pagination.limit)}
                    disabled={pagination.skip + pagination.limit >= pagination.total}
                    className={`relative inline-flex items-center px-3 py-2 rounded-r-lg border text-sm font-medium ${
                      pagination.skip + pagination.limit >= pagination.total
                        ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                        : 'text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-650'
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <FaArrowRight className="h-4 w-4" aria-hidden="true" />
                  </motion.button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // Render lab results list
  const renderLabResults = useCallback(() => {
    if (isLoadingResults) {
      return (
        <div className="flex justify-center items-center py-20">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30 border-t-indigo-500 dark:border-t-indigo-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FaSpinner className="text-indigo-500 dark:text-indigo-400 text-sm animate-pulse" />
              </div>
            </div>
            <span className="mt-4 text-slate-600 dark:text-slate-400 text-sm font-medium">Loading lab results...</span>
          </div>
        </div>
      );
    }

    // Filter lab results for the selected request
    const resultsToShow = filteredLabResults();

    if (!Array.isArray(resultsToShow) || resultsToShow.length === 0) {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="p-10 text-center"
        >
          <div className="relative mb-8 mx-auto">
            <div className="w-28 h-28 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto">
              <FaClipboard className="text-blue-500 dark:text-blue-400 text-3xl" />
            </div>
            <div className="absolute -right-2 bottom-0 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center">
              <FaWifi className={isConnected ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"} />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-3">No lab results yet</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {selectedRequest?.status === 'completed' 
              ? "No results found for this lab request." 
              : "This lab request is still being processed. Results will be available when completed."}
          </p>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2">
            {isConnected 
              ? "You'll receive real-time updates when results become available." 
              : "Connect to receive real-time updates when results become available."}
          </p>
          {!isConnected && !isConnecting && (
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={connect}
              className="mt-8 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl shadow-lg shadow-indigo-600/20 dark:shadow-indigo-800/20 font-medium"
            >
              Connect Now
            </motion.button>
          )}
        </motion.div>
      );
    }

    return (
      <div className="divide-y dark:divide-slate-700/60">
        <AnimatePresence>
          {resultsToShow.map((result) => {
            if (!result || typeof result !== 'object') return null;
            
            // Get all parameters in this result
            const paramNames = getParameterNames(result.result_data);
            
            // Determine if any parameter is abnormal
            let hasAbnormalParams = false;
            paramNames.forEach(paramName => {
              const paramData = result.result_data[paramName];
              if (paramData && isAbnormalValue(paramData.value, paramData.normal_range)) {
                hasAbnormalParams = true;
              }
            });

            // Use result id (either lab_result_id or id)
            const resultId = result.lab_result_id || result.id;
            const isExpanded = expandedResults[resultId] || false;
            
            return (
              <motion.div 
                key={resultId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                className={`p-5 transition-all ${
                  hasAbnormalParams 
                    ? 'bg-gradient-to-r from-red-50 to-white dark:from-red-900/10 dark:to-transparent' 
                    : !result.acknowledged 
                      ? 'bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/10 dark:to-transparent' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                }`}
              >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
                  <div>
                    <div 
                      onClick={() => toggleResultExpanded(resultId)}
                      className="flex items-center cursor-pointer mb-1"
                    >
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="mr-2 text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30 rounded-full p-1.5"
                      >
                        <FaChevronRight className="text-xs" />
                      </motion.div>
                      <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                        {result.test_type ? (
                          <span className="capitalize">{result.test_type.replace(/_/g, ' ')}</span>
                        ) : (
                          <span>Lab Result</span>
                        )}
                      </h3>
                      {!result.acknowledged && (
                        <span className="ml-3 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs flex items-center">
                          <span className="w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse mr-1.5"></span>
                          New
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-5 gap-y-2 mt-2">
                      {result.created_at && (
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-1.5 text-indigo-400" size={14} />
                          <span>{new Date(result.created_at).toLocaleDateString()} ({getTimeSince(result.created_at)})</span>
                        </div>
                      )}
                      {paramNames.length > 0 && (
                        <div className="flex items-center">
                          <FaClipboard className="mr-1.5 text-indigo-400" size={14} />
                          <span>{paramNames.length} parameter{paramNames.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium shadow-sm ${
                      hasAbnormalParams 
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40' 
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        hasAbnormalParams ? 'bg-red-500 dark:bg-red-400' : 'bg-emerald-500 dark:bg-emerald-400'
                      }`}></span>
                      {hasAbnormalParams ? 'Abnormal' : 'Normal'}
                    </span>
                    
                    {!result.acknowledged && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => acknowledgeResult(resultId)}
                        className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-md flex items-center shadow-md shadow-indigo-500/10 dark:shadow-indigo-800/10 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={!isConnected}
                        aria-label="Acknowledge result"
                        title={isConnected ? "Acknowledge this result" : "Cannot acknowledge: not connected"}
                      >
                        <FaCheckCircle className="mr-1.5" size={12} /> 
                        <span className="font-medium">Acknowledge</span>
                      </motion.button>
                    )}
                  </div>
                </div>
                
                {/* Lab Request ID */}
                {result.lab_request_id && (
                  <div className="mb-4 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3 flex items-center">
                    <span className="font-medium text-slate-700 dark:text-slate-300 mr-2">Lab Request ID:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400 tracking-tight">{result.lab_request_id}</span>
                  </div>
                )}

                {/* Conclusion (when available) */}
                {result.conclusion && (
                  <div className="mb-5 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border-l-4 border-blue-400 dark:border-blue-500">
                    <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-1">Conclusion</h4>
                    <p className="text-slate-700 dark:text-slate-300">{result.conclusion}</p>
                  </div>
                )}
                
                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-5"
                    >
                      {/* Parameters */}
                      <div className="mb-3">
                        <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-4 flex items-center text-sm uppercase tracking-wider">
                          <span className="inline-block w-1.5 h-5 bg-gradient-to-b from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700 rounded-sm mr-2.5"></span>
                          Test Parameters
                        </h4>
                        <div className="space-y-4">
                          {paramNames.map(paramName => {
                            const paramData = result.result_data[paramName];
                            const isAbnormal = isAbnormalValue(paramData?.value, paramData?.normal_range);
                            
                            return (
                              <ParameterCard 
                                key={paramName} 
                                paramName={paramName} 
                                paramData={paramData} 
                                isAbnormal={isAbnormal} 
                              />
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {!isExpanded && (
                  <div className="mt-4 text-center">
                    <motion.button 
                      onClick={() => toggleResultExpanded(resultId)}
                      whileHover={{ y: -2 }}
                      whileTap={{ y: 0 }}
                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm flex items-center mx-auto font-medium"
                      aria-label="View details"
                    >
                      View Details 
                      <FaChevronDown className="ml-1.5" size={12} />
                    </motion.button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }, [
    isLoadingResults, 
    filteredLabResults, 
    isConnected, 
    selectedRequest, 
    getParameterNames, 
    isAbnormalValue, 
    getTimeSince, 
    acknowledgeResult, 
    expandedResults, 
    connect, 
    isConnecting
  ]);

  return (
    <>
      <style>{fontCss}</style>
      <div 
        className="font-['Inter',sans-serif] antialiased bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-200" 
        style={{ colorScheme: 'light dark' }}
      >
        {/* Notification sound component */}
        <NotificationSound />
        
        {/* Popup notification */}
        <NotificationPopup 
          message={currentPopupMessage}
          isVisible={showPopupNotification}
          onClose={() => setShowPopupNotification(false)}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header section */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                {activeView === 'results' && selectedRequest 
                  ? 'Lab Results'
                  : 'Lab Result Dashboard'
                }
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1.5">
                {activeView === 'results' && selectedRequest
                  ? 'View detailed test results and parameters'
                  : 'Monitor laboratory tests and receive real-time updates'
                }
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Notification Bell */}
              <div className="relative" ref={notificationsRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-700/60 transition-all"
                  aria-label="Notifications"
                >
                  <FaBell className="text-xl" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[1.5rem] flex items-center justify-center shadow-md">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </motion.button>
                
                {/* Notifications dropdown */}
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2, type: "spring", stiffness: 400, damping: 25 }}
                      className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl z-50 overflow-hidden border border-slate-200 dark:border-slate-700/60"
                    >
                      <div className="border-b border-slate-200 dark:border-slate-700/60 py-3 px-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-2 text-indigo-600 dark:text-indigo-400">
                            <FaBell size={12} />
                          </div>
                          Notifications
                        </h3>
                        <div className="flex space-x-2">
                          {unreadCount > 0 && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setNotifications(prev => 
                                  prev.map(n => ({ ...n, read: true }))
                                );
                              }}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md"
                            >
                              Mark all as read
                            </motion.button>
                          )}
                        </div>
                      </div>
                      
                      <div className="max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {notifications.length === 0 ? (
                          <div className="py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                              <FaBell className="text-slate-400 dark:text-slate-500 text-xl" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">No notifications yet</p>
                            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                              You'll see new lab results here when they arrive
                            </p>
                          </div>
                        ) : (
                          notifications.map(notification => (
                            <NotificationItem 
                              key={notification.id}
                              notification={notification}
                              onViewDetails={handleViewNotificationDetails}
                              onDismiss={() => markNotificationAsRead(notification.id)}
                            />
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <motion.div 
                whileHover={{ scale: 1.03 }}
                className={`flex items-center px-4 py-2.5 rounded-xl shadow-md border ${
                  isConnected 
                    ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 dark:from-emerald-900/20 dark:to-emerald-900/10 dark:text-emerald-300 dark:border-emerald-800/40' 
                    : isConnecting
                      ? 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200 dark:from-amber-900/20 dark:to-amber-900/10 dark:text-amber-300 dark:border-amber-800/40'
                      : 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200 dark:from-red-900/20 dark:to-red-900/10 dark:text-red-300 dark:border-red-800/40'
                }`}
              >
                {isConnected ? (
                  <>
                    <FaWifi className="mr-2" />
                    <span className="font-medium">Connected</span>
                  </>
                ) : isConnecting ? (
                  <>
                    <FaSpinner className="mr-2 animate-spin" />
                    <span className="font-medium">Connecting...</span>
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle className="mr-2" />
                    <span className="font-medium">Disconnected</span>
                  </>
                )}
              </motion.div>
              
              {!isConnected && !isConnecting && (
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={connect}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 dark:shadow-indigo-800/20 font-medium border border-indigo-700/20 dark:border-indigo-400/10"
                  aria-label="Reconnect to server"
                >
                  Reconnect
                </motion.button>
              )}
            </div>
          </motion.div>
          
          {/* Recent Lab Results Section */}
          {activeView === 'requests' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3 text-indigo-600 dark:text-indigo-400">
                    <FaHistory size={16} />
                  </div>
                  Recent Lab Results
                </h2>
                {isScrollable && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                    <FaArrowRight className="mr-1.5 animate-pulse" />
                    Scroll to see more
                  </p>
                )}
              </div>
              
              {renderRecentResults()}
            </motion.div>
          )}
          
          {/* View navigation */}
          {activeView === 'requests' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="mb-6 flex"
            >
              <div className="flex border-b border-slate-200 dark:border-slate-700/60 w-full">
                <button 
                  onClick={() => setActiveView('requests')}
                  className={`py-2.5 px-4 flex items-center ${
                    activeView === 'requests' 
                      ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 dark:border-indigo-400 font-medium' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <FaList className="mr-2" size={14} />
                  Lab Requests
                </button>
                {selectedRequest && (
                  <button 
                    onClick={() => setActiveView('results')}
                    className={`py-2.5 px-4 flex items-center ${
                      activeView === 'results' 
                        ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 dark:border-indigo-400 font-medium' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <FaFlask className="mr-2" size={14} />
                    Results
                  </button>
                )}
              </div>
            </motion.div>
          )}
          
          {/* Breadcrumb for results view */}
          {activeView === 'results' && selectedRequest && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="mb-6 flex items-center"
            >
              <motion.button
                whileHover={{ x: -3 }}
                onClick={() => setActiveView('requests')}
                className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition-colors"
              >
                <FaArrowLeft className="mr-2" size={14} />
                Back to Lab Requests
              </motion.button>
              <div className="mx-3 text-slate-400 dark:text-slate-500">/</div>
              <div className="text-slate-600 dark:text-slate-400 truncate flex items-center">
                <span className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full p-1 mr-2 text-indigo-600 dark:text-indigo-400">
                  <FaFlask size={12} />
                </span>
                {selectedRequest.test_type || 'Lab Test Results'}
              </div>
            </motion.div>
          )}
          
          {/* Errors */}
          <AnimatePresence>
            {error && !error.includes("Connection error") && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="mb-8 p-4 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 rounded-xl shadow-sm flex justify-between items-center border border-red-200 dark:border-red-800/40"
              >
                <div className="flex items-center">
                  <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-2 mr-3">
                    <FaExclamationTriangle className="text-lg flex-shrink-0" />
                  </div>
                  <span className="font-medium">{error}</span>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-300 p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full"
                  aria-label="Dismiss error"
                >
                  <FaTimes />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Content based on active view */}
          {activeView === 'requests' ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700/60"
            >
              <div className="p-5 sm:p-6 border-b dark:border-slate-700/60 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3 text-indigo-600 dark:text-indigo-400">
                    <FaList size={16} />
                  </div>
                  Lab Requests
                </h2>
                <div className="flex items-center">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleSortOrder}
                    className="ml-3 p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg shadow-sm"
                    title={`Sort ${sorting.sort_order === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sorting.sort_order === 'asc' ? (
                      <FaSortAmountUp size={16} />
                    ) : (
                      <FaSortAmountDown size={16} />
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchLabRequests}
                    className="ml-3 p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg shadow-sm"
                    title="Refresh data"
                  >
                    <FaSearch size={16} />
                  </motion.button>
                </div>
              </div>
              
              <ErrorBoundary>
                {renderLabRequestsList()}
              </ErrorBoundary>
            </motion.div>
          ) : (
            <>
              {/* Selected Request Details */}
              {selectedRequest && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                  className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-200 dark:border-slate-700/60"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3 text-indigo-600 dark:text-indigo-400">
                          <FaFlask size={16} />
                        </div>
                        {selectedRequest.test_type ? selectedRequest.test_type.replace(/_/g, ' ') : 'Lab Test'}
                      </h2>
                      <div className="space-y-2">
                        {selectedRequest.patient_name && (
                          <div className="flex items-center text-slate-600 dark:text-slate-400">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3 text-blue-600 dark:text-blue-400">
                              <FaUser size={14} />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-500">Patient</p>
                              <p className="font-medium text-slate-700 dark:text-slate-300">
                                {selectedRequest.patient_name}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedRequest.created_at && (
                          <div className="flex items-center text-slate-600 dark:text-slate-400">
                            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mr-3 text-purple-600 dark:text-purple-400">
                              <FaCalendarAlt size={14} />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-500">Requested on</p>
                              <p className="font-medium text-slate-700 dark:text-slate-300">
                                {formatDate(selectedRequest.created_at)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 items-start">
                      {selectedRequest.status && (
                        <div className="flex flex-col items-center bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/50 p-3 shadow-sm">
                          <p className="text-xs text-slate-500 dark:text-slate-500 mb-1.5">Status</p>
                          <StatusBadge status={selectedRequest.status} />
                        </div>
                      )}
                      {selectedRequest.urgency && (
                        <div className="flex flex-col items-center bg-white dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/50 p-3 shadow-sm">
                          <p className="text-xs text-slate-500 dark:text-slate-500 mb-1.5">Urgency</p>
                          <UrgencyBadge urgency={selectedRequest.urgency} />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Lab request ID */}
                  {selectedRequest.id && (
                    <div className="mt-5 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3.5">
                      <div className="flex flex-wrap items-center">
                        <span className="font-medium text-slate-700 dark:text-slate-300 mr-3">Request ID:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400 tracking-tight bg-white dark:bg-slate-800 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700/40 text-xs">{selectedRequest.id}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
              
              {/* Lab Results Display */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700/60"
              >
                <div className="p-5 sm:p-6 border-b dark:border-slate-700/60 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80">
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mr-3 text-indigo-600 dark:text-indigo-400">
                      <FaFlask size={16} />
                    </div>
                    Test Results
                  </h2>
                  <div className="flex items-center">
                    <span className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium shadow-sm border border-indigo-200 dark:border-indigo-800/40">
                      {filteredLabResults().length} result{filteredLabResults().length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                <ErrorBoundary>
                  {renderLabResults()}
                </ErrorBoundary>
              </motion.div>
            </>
          )}
        </div>
      </div>
      <Toaster position="top-right" />

      {/* Add dark mode detection */}
      <script dangerouslySetInnerHTML={{
        __html: `
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          }
          
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (event.matches) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          });
        `
      }} />
      
      {/* Tailwind Configuration */}
      <script dangerouslySetInnerHTML={{
        __html: `
          tailwind.config = {
            darkMode: 'class',
            theme: {
              extend: {
                colors: {
                  indigo: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                    950: '#1e1b4b',
                  },
                  slate: {
                    650: '#374151',
                    750: '#2D3748',
                  }
                },
                boxShadow: {
                  'inner-lg': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
                  'highlight': '0 0 0 2px rgba(99, 102, 241, 0.3)',
                },
                fontFamily: {
                  sans: ['Inter', 'system-ui', 'sans-serif'],
                },
                animation: {
                  'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                },
              },
            },
            plugins: [
              // Create a custom scrollbar plugin
              function({ addUtilities }) {
                const newUtilities = {
                  '.scrollbar-thin': {
                    'scrollbarWidth': 'thin',
                    '&::-webkit-scrollbar': {
                      width: '6px',
                      height: '6px',
                    },
                  },
                  '.scrollbar-thumb-slate-300': {
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: '#cbd5e1',
                      borderRadius: '9999px',
                    },
                  },
                  '.scrollbar-thumb-slate-700': {
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: '#334155',
                      borderRadius: '9999px',
                    },
                  },
                  '.scrollbar-track-transparent': {
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: 'transparent',
                    },
                  },
                }
                addUtilities(newUtilities)
              }
            ]
          }
        `
      }} />
    </>
  );
}

// Wrap the exported component with ErrorBoundary for top-level protection
export default function LabResultsWithErrorBoundary() {
  // Apply preferred color scheme
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      if (event.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
  }, []);
  
  return (
    <ErrorBoundary>
      <LabResultsWS />
    </ErrorBoundary>
  );
}
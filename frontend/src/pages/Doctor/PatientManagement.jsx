import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  FiSearch, FiUser, FiEdit, FiFileText, FiSave, 
  FiAlertCircle, FiCheckCircle, FiEye, FiPlus, FiMinus, 
  FiList, FiCalendar, FiX, FiClock, FiActivity, FiRefreshCw,
  FiInfo, FiTrendingUp, FiShield, FiHeart, FiSettings,
  FiBell, FiMessageSquare, FiChevronDown, FiChevronRight, FiArrowRight,
  FiDownload, FiShare2, FiPrinter, FiAward, FiStar
} from 'react-icons/fi';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext'; // Assuming you have an auth context
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Error boundary component based on React docs
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', info.componentStack);
    
    if (process.env.NODE_ENV !== 'production' && React.captureOwnerStack) {
      console.debug('Owner stack:', React.captureOwnerStack());
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 bg-red-50/80 dark:bg-red-950/30 backdrop-blur-sm border border-red-200 dark:border-red-800/50 rounded-2xl text-red-700 dark:text-red-300 shadow-xl animate-fade-in">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-4">
              <FiAlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">System Error</h3>
              <p className="text-sm mt-1 text-red-600 dark:text-red-400">We encountered an unexpected issue</p>
            </div>
          </div>
          <p className="mb-4 text-red-600/80 dark:text-red-400/80">The notification system encountered an error. Our team has been notified and is working to resolve this issue.</p>
          <button 
            className="px-4 py-2 bg-white dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/50 transition-all duration-200 shadow-sm"
            onClick={() => window.location.reload()}
          >
            Refresh Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// NotificationCenter component
const NotificationCenter = ({ doctor_id, onNewPatientAssigned, onViewPatientDetails }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const notificationSoundRef = useRef(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const notificationRef = useRef(null);
  
  // WebSocket refs
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const failedAttemptsRef = useRef(0);

  // Reconnection strategy parameters
  const MAX_RECONNECT_ATTEMPTS = 3;
  const INITIAL_RECONNECT_DELAY = 1000;
  const MAX_RECONNECT_DELAY = 10000;
  const BACKOFF_FACTOR = 1.5;

  // Animation controls for bell
  const bellAnimation = useAnimation();

  // Close notification panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Track user interaction to enable sound
  useEffect(() => {
    const handleUserInteraction = () => {
      setUserInteracted(true);
      // Remove the event listeners once we've detected interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Play notification sound with customized volume
  const playNotificationSound = useCallback(() => {
    if (notificationSoundRef.current && userInteracted) {
      notificationSoundRef.current.volume = 0.4; // Softer volume
      notificationSoundRef.current.currentTime = 0;
      notificationSoundRef.current.play().catch(err => {
        console.log('Error playing sound:', err);
      });
    }
  }, [userInteracted]);

  // Animate bell when new notification arrives
  const animateBell = useCallback(async () => {
    await bellAnimation.start({
      rotate: [0, 15, -15, 10, -10, 5, -5, 0],
      transition: { duration: 0.8, ease: "easeInOut" }
    });
  }, [bellAnimation]);

  // Clean up function to reset all WebSocket state and clear timers
  const cleanupWebSocket = useCallback(() => {
    if (wsRef.current) {
      // Remove all event listeners to prevent memory leaks
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      
      // Close the connection if still open
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    
    // Clear all timers
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Reset connection state
    setConnecting(false);
  }, []);

  // Switch to fallback mode
  const enableFallbackMode = useCallback(() => {
    console.log("Switching to fallback notification mode");
    setFallbackMode(true);
    setConnected(true); // We're "connected" in fallback mode
    setConnectionError(null);
  }, []);

  // Handle reconnection with exponential backoff
  const handleReconnect = useCallback(() => {
    // If we've failed too many times, switch to fallback mode
    if (failedAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts. Switching to fallback mode.`);
      enableFallbackMode();
      return;
    }
    
    // Calculate backoff delay with exponential backoff
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(BACKOFF_FACTOR, failedAttemptsRef.current - 1),
      MAX_RECONNECT_DELAY
    );
    
    // Add some jitter to prevent all clients reconnecting simultaneously
    const jitteredDelay = delay * (0.8 + Math.random() * 0.4);
    
    console.log(`Reconnecting in ${Math.round(jitteredDelay)}ms (attempt ${failedAttemptsRef.current})`);
    
    // Schedule reconnection
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      // Only reconnect if we're not already connecting and not in fallback mode
      if (!connecting && !fallbackMode) {
        connectWebSocket();
      }
    }, jitteredDelay);
  }, [connecting, fallbackMode, enableFallbackMode]);
  
  // Function to connect to WebSocket with proper error handling
  const connectWebSocket = useCallback(() => {
    if (!doctor_id || connecting || fallbackMode || wsRef.current) {
      return;
    }
    
    // Clean up any existing connection first
    cleanupWebSocket();
    
    setConnecting(true);
    setConnectionError(null);
    
    try {
      console.log('Connecting to WebSocket:', `ws://${window.location.hostname}:8024/ws/opd/${doctor_id}`);
      
      // Create WebSocket connection
      wsRef.current = new WebSocket(`ws://${window.location.hostname}:8024/ws/opd/${doctor_id}`);
      
      // Set connection timeout - if connection isn't established in 10 seconds, retry
      connectionTimeoutRef.current = setTimeout(() => {
        console.log("WebSocket connection timeout");
        
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        
        failedAttemptsRef.current++;
        setConnecting(false);
        setConnectionError("Connection timeout");
        
        // Handle reconnect or fallback logic
        handleReconnect();
      }, 10000);
      
      // Handle successful connection
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
        
        setConnected(true);
        setConnecting(false);
        failedAttemptsRef.current = 0;
      };
      
      // Handle connection closed
      wsRef.current.onclose = (event) => {
        if (event.wasClean) {
          console.log(`WebSocket connection closed cleanly, code=${event.code}, reason=${event.reason}`);
        } else {
          console.log(`WebSocket connection died, code=${event.code}`);
        }
        
        // Only handle if we still have a reference to this WebSocket
        if (wsRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
          
          wsRef.current = null;
          setConnected(false);
          setConnecting(false);
          
          // Try to reconnect if it wasn't a clean close
          if (!event.wasClean) {
            handleReconnect();
          }
        }
      };
      
      // Handle connection error
      wsRef.current.onerror = (error) => {
        console.log('WebSocket error:', error);
        
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
        
        setConnectionError('Could not connect to notification service');
        setConnecting(false);
        
        failedAttemptsRef.current++;
        handleReconnect();
      };
      
      // Handle incoming messages
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);
          
          if (data.event === 'connection_established') {
            // Handle connection established
            setConnected(true);
          } 
          else if (data.event === 'patient_assigned' || data.event === 'notification') {
            // Handle new notification
            handleNewNotification(data);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      setConnectionError('Failed to initialize notification service');
      setConnecting(false);
      failedAttemptsRef.current++;
      
      handleReconnect();
    }
  }, [doctor_id, connecting, fallbackMode, cleanupWebSocket, handleReconnect]);

  // Handle new notification
  const handleNewNotification = useCallback((data) => {
    // Debug log to see data structure
    console.log('Processing notification data:', JSON.stringify(data, null, 2));
    
    // For patient assignments, we want additional validation to prevent incomplete patient data
    if (data.event === 'patient_assigned') {
      // For debugging: log details about the patient data
      console.log('Patient data check:', {
        hasDataObject: Boolean(data.data),
        patientObject: data.data?.patient,
        patientId: data.data?.patient_id || data.data?.patient?.id,
        assignmentId: data.assignment_id
      });
      
      // Skip notifications with empty data object
      if (!data.data || Object.keys(data.data).length === 0) {
        console.log('Skipping notification with empty data object:', data);
        return;
      }
      
      // Check if patient data has required fields
      const patientData = data.data.patient || {};
      const hasValidPatientData = (
        // Must have a patient_id or patient object with id
        (data.data.patient_id || (patientData && patientData.id)) &&
        // Must have at least first name or last name
        ((patientData.first_name && patientData.first_name.trim()) || 
         (patientData.last_name && patientData.last_name.trim()) ||
         (data.data.patient_name && data.data.patient_name.trim()))
      );
      
      if (!hasValidPatientData) {
        console.log('Skipping notification with incomplete patient data:', data);
        return;
      }
      
      // Check if we already have this notification (prevents duplicates)
      const notificationExists = notifications.some(
        n => n.id === data.message_id || 
            (n.data?.patient && 
             data.data?.patient && 
             n.data.patient.id === data.data.patient.id && 
             new Date(n.timestamp) > new Date(Date.now() - 10000)) // Within last 10 seconds
      );
      
      if (notificationExists) {
        console.log('Ignoring duplicate notification:', data);
        return;
      }
    }
    
    // Create a notification object
    const newNotification = {
      id: data.message_id || `notif-${Date.now()}`,
      title: data.data?.title || 'New Notification',
      message: data.data?.message || 'You have a new notification',
      timestamp: data.timestamp || new Date().toISOString(),
      type: data.event,
      read: false,
      data: data.data || {}
    };
    
    // Add notification to state
    setNotifications(prev => [newNotification, ...prev.slice(0, 19)]);
    setUnreadCount(prev => prev + 1);
    
    // Play sound and animate bell
    playNotificationSound();
    animateBell();
    
    // For patient assignments, notify parent component
    if (data.event === 'patient_assigned' && data.data && onNewPatientAssigned) {
      // Try to extract patient data from different possible structures
      const patientData = data.data.patient || {};
      
      // Extract patient ID from possible locations
      const patientId = data.data.patient_id || patientData.id;
      
      // Extract name if available from different possible structures
      let firstName = '';
      let lastName = '';
      
      if (patientData.name) {
        const nameParts = patientData.name.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      } else if (patientData.first_name || patientData.last_name) {
        firstName = patientData.first_name || '';
        lastName = patientData.last_name || '';
      } else if (data.data.patient_name) {
        const nameParts = data.data.patient_name.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      }
      
      // Validate first/last name - must have at least one
      if (!firstName && !lastName) {
        console.log('Skipping patient with no name information:', data);
        return;
      }
      
      // Create a patient object with available info
      const patient = {
        id: patientId,
        first_name: firstName,
        last_name: lastName,
        registration_number: patientData.registration_number || data.data.patient_registration,
        date_of_birth: patientData.date_of_birth || 
                      (patientData.age ? new Date(new Date().setFullYear(new Date().getFullYear() - patientData.age)).toISOString() : null),
        gender: patientData.gender,
        phone_number: patientData.phone_number,
        email: patientData.email,
        isNew: true, // Flag as new patient
        assignedTimestamp: data.timestamp
      };
      
      // Call parent handler with patient data
      console.log('Notifying parent about new patient:', patient);
      onNewPatientAssigned(patient);
      
      // Show toast notification with patient name if available
      const patientName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'New patient';
      toast.success(`New patient assigned: ${patientName}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: "bg-white dark:bg-slate-800 shadow-xl",
        bodyClassName: "text-slate-700 dark:text-slate-200",
        progressClassName: "bg-teal-500 dark:bg-teal-400"
      });
    } else if (data.event !== 'connection_established') {
      // Show regular toast notification for non-patient notifications
      // Skip connection_established notifications
      toast.info(newNotification.title, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: "bg-white dark:bg-slate-800 shadow-xl",
        bodyClassName: "text-slate-700 dark:text-slate-200",
        progressClassName: "bg-blue-500 dark:bg-blue-400"
      });
    }
  }, [animateBell, notifications, onNewPatientAssigned, playNotificationSound]);
  
  // Initialize WebSocket connection
  useEffect(() => {
    // Only try to connect if we have a doctor_id and we're not in fallback mode
    if (doctor_id && !fallbackMode && !wsRef.current) {
      // Wait a moment before attempting to connect (to avoid connection rushes)
      const timer = setTimeout(() => {
        connectWebSocket();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [doctor_id, fallbackMode, connectWebSocket]);
  
  // Clean up WebSocket and intervals when component unmounts
  useEffect(() => {
    return () => {
      cleanupWebSocket();
      
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [cleanupWebSocket]);
  
  // Update unread count
  const updateUnreadCount = useCallback(() => {
    const count = notifications.filter(notif => !notif.read).length;
    setUnreadCount(count);
  }, [notifications]);
  
  // Mark notification as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
    
    updateUnreadCount();
  }, [updateUnreadCount]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setUnreadCount(0);
  }, []);
  
  // Format relative time for notifications
  const formatRelativeTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return notifTime.toLocaleDateString();
  }, []);
  
  // Actual rendering of the component
  const notificationContent = (
    <>
      {/* Audio for notification sound */}
      <audio ref={notificationSoundRef} preload="auto">
        <source src="https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg" type="audio/ogg" />
      </audio>
      
      {/* Notification bell button */}
      <div ref={notificationRef} className="relative z-50">
        <motion.div
          animate={bellAnimation}
          className="relative"
        >
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="group p-2.5 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 relative shadow-sm hover:shadow-md"
            aria-label="Show notifications"
          >
            <FiBell className="w-5 h-5 transition-colors duration-200 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center shadow-lg">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </motion.div>
        
        {/* Notification dropdown */}
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 mt-20 sm:mt-16 mr-4 sm:mr-8 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden backdrop-blur-sm"
              style={{ zIndex: 9999 }}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="font-medium text-slate-800 dark:text-white text-base">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                    aria-label="Close notifications"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="max-h-[min(90vh,32rem)] overflow-y-auto overscroll-contain">
                {notifications.length > 0 ? (
                  <div className="py-1">
                    {notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700/40 last:border-b-0 transition-colors duration-200 ${
                          !notification.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mr-3">
                            {notification.type === 'patient_assigned' ? (
                              <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
                                <FiUser className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                                <FiMessageSquare className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {notification.title}
                              </p>
                              <p className="ml-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                                {formatRelativeTime(notification.timestamp)}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                              {notification.message}
                            </p>
                            
                            {/* Patient preview if available */}
                            {notification.data?.patient && (
                              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200/70 dark:border-slate-600/30 text-xs shadow-sm">
                                <div className="flex items-center">
                                  <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm mr-2">
                                    <FiUser className="w-3 h-3" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">
                                      {notification.data.patient.name || 'New Patient'}
                                    </p>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                                      {notification.data.patient.registration_number || 'No Reg #'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Action links */}
                            <div className="mt-2 flex justify-between items-center">
                              {!notification.read && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  New
                                </span>
                              )}
                              
                              {notification.type === 'patient_assigned' && (
                                <button 
                                  onClick={() => {
                                    const patientId = notification.data?.patient_id || 
                                                     notification.data?.patient?.id || 
                                                     notification.assignment_id;
                                    if (onViewPatientDetails && patientId) {
                                      markAsRead(notification.id);
                                      onViewPatientDetails(patientId);
                                      setShowNotifications(false);
                                    }
                                  }}
                                  className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center group"
                                >
                                  View Patient
                                  <FiArrowRight className="ml-1 w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 px-6 text-center">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="mx-auto"
                    >
                      <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4 shadow-inner">
                        <FiBell className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h4 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">No notifications yet</h4>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        We'll notify you when there are updates
                      </p>
                    </motion.div>
                  </div>
                )}
              </div>
              
              {/* Connection status */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-700/50 text-xs flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    connected ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-rose-500 dark:bg-rose-400'
                  }`}></div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {fallbackMode 
                      ? 'Using simulated notifications' 
                      : connected 
                        ? 'Connected' 
                        : connectionError || 'Disconnected'
                    }
                  </span>
                </div>
                
                {!connected && !connecting && !fallbackMode && (
                  <button
                    onClick={() => {
                      // Reset failed attempts counter and try again
                      failedAttemptsRef.current = 0;
                      connectWebSocket();
                    }}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 font-medium text-xs"
                  >
                    Reconnect
                  </button>
                )}
                
                {connecting && (
                  <div className="flex items-center text-slate-500 dark:text-slate-400">
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Connecting...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  // Wrap component with error boundary
  return (
    <ErrorBoundary fallback={
      <div className="p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/70 dark:border-red-800/40 rounded-2xl shadow-lg">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-400 mr-4">
            <FiAlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-red-700 dark:text-red-300">Notification System Error</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Please refresh the page to restore notifications
            </p>
          </div>
        </div>
      </div>
    }>
      {notificationContent}
    </ErrorBoundary>
  );
};

// RecentPatientCards component
const RecentPatientCards = ({ patients, onViewPatientDetails, getInitials, getFullName }) => {
  // Only show last 3 recently assigned patients
  const recentPatients = patients.slice(0, 3);
  
  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-4 flex items-center">
        <span className="w-1 h-6 bg-gradient-to-b from-teal-400 to-blue-500 rounded-full mr-2.5"></span>
        Recently Assigned
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recentPatients.map(patient => (
          <motion.div
            key={patient.id}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group p-5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden"
            onClick={() => onViewPatientDetails(patient.id)}
          >
            {/* Accent glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-400/10 via-blue-500/5 to-purple-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="flex items-start relative">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white mr-4 shadow-md group-hover:shadow-lg transition-shadow duration-200">
                <span className="text-base font-semibold">{getInitials(patient)}</span>
              </div>
              <div>
                <h4 className="font-medium text-slate-800 dark:text-white text-base group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-200">
                  {getFullName(patient)}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {patient.registration_number || 'No Reg #'}
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  {patient.isNew && (
                    <span className="inline-block px-1.5 py-0.5 bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 text-xs rounded-full font-medium">
                      New
                    </span>
                  )}
                  {patient.gender && (
                    <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs rounded-full">
                      {patient.gender}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* View details indicator */}
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="p-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                <FiEye className="w-3.5 h-3.5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Main PatientManagement component
const PatientManagement = () => {
  // State for patient management
  const [allPatients, setAllPatients] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [patientsPerPage] = useState(10);
  const [totalPatients, setTotalPatients] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [operationSuccess, setOperationSuccess] = useState('');
  const [patientRecords, setPatientRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newRecord, setNewRecord] = useState({
    diagnosis: '',
    treatment: '',
    notes: '',
    medications: [],
    vital_signs: {
      temperature: '',
      blood_pressure: '',
      heart_rate: '',
      respiratory_rate: '',
      oxygen_saturation: ''
    },
    follow_up_date: '',
    is_active: true
  });
  const [medicationInput, setMedicationInput] = useState('');
  const [formError, setFormError] = useState('');
  const [formTouched, setFormTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [editRecordData, setEditRecordData] = useState(null);
  const [editRecordError, setEditRecordError] = useState('');
  const [editFormTouched, setEditFormTouched] = useState({});
  const [updatingRecord, setUpdatingRecord] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMedicalRecordsModal, setShowMedicalRecordsModal] = useState(false);
  const [showViewRecordModal, setShowViewRecordModal] = useState(false);
  const [showEditRecordModal, setShowEditRecordModal] = useState(false);
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  
  // Determine if we're in dark mode
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  // Listen for dark mode changes
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e) => {
      setIsDarkMode(e.matches);
    };
    
    darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
    };
  }, []);
  
  // Get auth context
  const { user } = useAuth();
  
  // Helper functions
  const getFullName = (patient) => {
    if (!patient) return 'Unknown Patient';
    const firstName = patient.first_name || '';
    const lastName = patient.last_name || '';
    
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    if (lastName) return lastName;
    
    return 'Unknown Patient';
  };
  
  const getInitials = (patient) => {
    if (!patient) return '?';
    const firstName = patient.first_name || '';
    const lastName = patient.last_name || '';
    
    if (firstName && lastName) return `${firstName.charAt(0)}${lastName.charAt(0)}`;
    if (firstName) return firstName.charAt(0);
    if (lastName) return lastName.charAt(0);
    
    return '?';
  };
  
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return isNaN(age) ? 'N/A' : age;
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Handle new patient assignment from notification
  const handleNewPatientAssigned = (patient) => {
    // Only process patients with a valid id and name information
    if (!patient || !patient.id || (!patient.first_name && !patient.last_name)) {
      console.log('Skipping patient with missing required data:', patient);
      return;
    }

    console.log('Adding/updating patient:', patient);
    
    // Check if patient already exists
    const patientExists = allPatients.some(p => p.id === patient.id);
    
    if (patientExists) {
      // Update the existing patient
      setAllPatients(prev => 
        prev.map(p => p.id === patient.id ? { ...p, isNew: true, assignedTimestamp: patient.assignedTimestamp } : p)
      );
    } else {
      // Add new patient to the list
      setAllPatients(prev => [patient, ...prev]);
    }
  };

  // Method to view patient details (used by notification center)
  const handleViewPatientDetails = (patientId) => {
    if (patientId) {
      viewPatientDetails(patientId);
    }
  };

  // Get recently assigned patients (with isNew flag or assignedTimestamp)
  const recentlyAssignedPatients = useMemo(() => {
    return allPatients.filter(patient => 
      (patient.isNew || patient.assignedTimestamp || patient.created_at) && 
      // Only include patients with name information
      (patient.first_name || patient.last_name)
    );
  }, [allPatients]);

  // Filter patients based on search term - client-side filtering
  const filteredPatients = useMemo(() => {
    if (!allPatients.length) return [];
    
    // If no search term, return all patients
    if (!searchTerm) return allPatients;
    
    return allPatients.filter(patient => {
      // Skip patients with missing required information
      if (!patient.id || (!patient.first_name && !patient.last_name)) {
        return false;
      }
      
      // Apply search filter - even with a single character
      const fullName = getFullName(patient).toLowerCase();
      const searchTermLower = searchTerm.toLowerCase();
      
      return fullName.includes(searchTermLower) || 
             (patient.email && patient.email.toLowerCase().includes(searchTermLower)) ||
             (patient.phone_number && patient.phone_number.includes(searchTerm)) ||
             (patient.registration_number && patient.registration_number.toLowerCase().includes(searchTermLower));
    });
  }, [allPatients, searchTerm]);

  // Calculate paginated patients
  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * patientsPerPage;
    const endIndex = startIndex + patientsPerPage;
    
    // Sort patients so that new patients appear at the top
    const sortedPatients = [...filteredPatients].sort((a, b) => {
      // New patients first
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      
      // Then by assignment timestamp (if available)
      if (a.assignedTimestamp && b.assignedTimestamp) {
        return new Date(b.assignedTimestamp) - new Date(a.assignedTimestamp);
      }
      
      // Then by creation date
      if (a.created_at && b.created_at) {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      
      // Otherwise maintain order
      return 0;
    });
    
    return sortedPatients.slice(startIndex, endIndex);
  }, [filteredPatients, currentPage, patientsPerPage]);

  // Update total patients count and current page when filters change
  useEffect(() => {
    setTotalPatients(filteredPatients.length);
    // Reset to first page when filters change
    if (currentPage !== 1 && filteredPatients.length <= patientsPerPage) {
      setCurrentPage(1);
    }
  }, [filteredPatients, currentPage, patientsPerPage]);

  // Fetch all patients on initial load
  useEffect(() => {
    fetchAllPatients();
  }, []);
  
  // Auto-hide success messages after 3 seconds
  useEffect(() => {
    if (operationSuccess) {
      toast.success(operationSuccess, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        className: "bg-white dark:bg-slate-800 shadow-xl",
        bodyClassName: "text-slate-700 dark:text-slate-200",
        progressClassName: "bg-emerald-500 dark:bg-emerald-400"
      });
      
      const timer = setTimeout(() => {
        setOperationSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [operationSuccess]);

  const fetchAllPatients = async () => {
    try {
      setLoading(true);
      
      // Get all patients without pagination for client-side filtering
      const response = await axios.get('http://localhost:8024/patients/', {
        params: { doctor_id: user.id }
      });
      
      if (response.data.patients) {
        // Filter out patients with missing required fields
        const validPatients = response.data.patients.filter(
          patient => patient.id && (patient.first_name || patient.last_name)
        );
        
        setAllPatients(validPatients);
        setPatients(validPatients);
        setTotalPatients(validPatients.length);
      } else {
        setError('Failed to fetch patients');
      }
    } catch (err) {
      setError(`Error fetching patients: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const viewPatientDetails = async (patientId) => {
    try {
      setLoadingDetails(true);
      setDetailsError('');
      
      const response = await axios.get(`http://localhost:8023/api/patients/${patientId}`);
      
      if (response.data && response.data.id) {
        // Validate patient data before showing details
        if (!response.data.first_name && !response.data.last_name) {
          setDetailsError('Patient has incomplete information. Please ask the patient to update their profile.');
          return;
        }
        
        setSelectedPatient(response.data);
        setShowDetailsModal(true);
        
        // Mark patient as no longer new
        setAllPatients(prev => 
          prev.map(p => p.id === patientId ? { ...p, isNew: false } : p)
        );
      } else {
        setDetailsError('Failed to load patient details');
      }
    } catch (err) {
      console.error('Error fetching patient details:', err);
      setDetailsError(`Error loading patient details: ${err.message}`);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Function to fetch medical records for a patient
  const fetchPatientRecords = async (patientId) => {
    try {
      setLoadingRecords(true);
      setRecordsError('');
      
      const response = await axios.get(`http://localhost:8024/patients/${patientId}/medical-records`, {
        params: { doctor_id: user.id }
      });
      
      if (response.data && response.data.success) {
        setPatientRecords(response.data.records || []);
        setShowMedicalRecordsModal(true);
      } else {
        setRecordsError('Failed to load medical records');
      }
    } catch (err) {
      console.error('Error fetching medical records:', err);
      setRecordsError(`Error loading medical records: ${err.message}`);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Function to view a specific medical record
  const viewMedicalRecord = async (patientId, recordId) => {
    try {
      setLoadingRecords(true);
      setRecordsError('');
      
      const response = await axios.get(`http://localhost:8024/patients/${patientId}/medical-records/${recordId}`, {
        params: { doctor_id: user.id }
      });
      
      if (response.data && response.data.success) {
        // Extract the record data from the response
        const recordData = response.data.record;
        
        // Update state with the retrieved record
        setSelectedRecord(recordData);
        setShowViewRecordModal(true);
        
        // Optional: Track record view in analytics
        console.log(`Record view tracked: Patient ${patientId}, Record ${recordId}`);
      } else {
        // Handle case where API call succeeded but record wasn't found
        setRecordsError(response.data?.message || 'Failed to load medical record');
        
        // Show toast notification for record not found
        toast.error('Medical record not found or access denied', {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          className: "bg-white dark:bg-slate-800 shadow-xl",
          bodyClassName: "text-slate-700 dark:text-slate-200",
          progressClassName: "bg-red-500 dark:bg-red-400"
        });
      }
    } catch (err) {
      console.error('Error fetching medical record:', err);
      // Handle API error response or connection error
      const errorMessage = err.response?.data?.detail || err.message || 'Error loading medical record';
      setRecordsError(`Error: ${errorMessage}`);
      
      // Show toast notification for error
      toast.error(`Failed to load medical record: ${errorMessage}`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
    } finally {
      setLoadingRecords(false);
    }
  };

  // Function to open the edit record modal
  const openEditRecord = (record) => {
    setEditRecordData({...record});
    setEditRecordError('');
    setEditFormTouched({});
    setShowEditRecordModal(true);
  };

  // Field validation helper function
  const validateField = (name, value) => {
    if (name === 'diagnosis' && !value.trim()) {
      return 'Diagnosis is required';
    }
    return '';
  };

  // Function to update medical record
  const updateMedicalRecord = async () => {
    // Touch all fields to trigger validation
    const allFieldsTouched = {};
    allFieldsTouched['diagnosis'] = true;
    setEditFormTouched(allFieldsTouched);
    
    if (!editRecordData || !editRecordData.diagnosis) {
      setEditRecordError('Diagnosis is required');
      return;
    }
    
    try {
      setUpdatingRecord(true);
      setEditRecordError('');
      
      const response = await axios.patch(
        `http://localhost:8024/patients/${selectedPatient.id}/medical-records/${editRecordData.id}`, 
        editRecordData,
        {
          params: { 
            doctor_id: user.id 
          }
        }
      );
      
      // Log the response to see its exact structure
      console.log("Update record response:", response.data);
      
      // Check for a successful response - this is more flexible and doesn't rely on specific fields
      if (response.status >= 200 && response.status < 300) {
        // Display a success toast notification immediately
        toast.success('Medical record updated successfully!', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          className: "bg-white dark:bg-slate-800 shadow-xl",
          bodyClassName: "text-slate-700 dark:text-slate-200",
          progressClassName: "bg-emerald-500 dark:bg-emerald-400"
        });
        
        // Set success message in the UI
        setOperationSuccess('Medical record updated successfully');
        
        // Get updated record data from the response or use the current data if not available
        const updatedRecord = response.data || editRecordData;
        
        // Update the records in the local state
        setPatientRecords(prevRecords => 
          prevRecords.map(record => 
            record.id === editRecordData.id ? updatedRecord : record
          )
        );
        
        // Update selected record if it's being viewed
        if (selectedRecord && selectedRecord.id === editRecordData.id) {
          setSelectedRecord(updatedRecord);
        }
        
        // Close modal after a small delay to ensure toast is visible
        setTimeout(() => {
          setShowEditRecordModal(false);
        }, 300);
      } else {
        setEditRecordError('Failed to update medical record');
      }
    } catch (err) {
      // Log the full error
      console.error('Error updating medical record:', err);
      
      // Extract the most useful error message
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
      setEditRecordError(`Error updating medical record: ${errorMessage}`);
    } finally {
      setUpdatingRecord(false);
    }
  };

  const openAddMedicalRecord = (patient) => {
    // Validate patient has required information
    if (!patient || !patient.id || (!patient.first_name && !patient.last_name)) {
      toast.error('Cannot add medical record for a patient with incomplete information');
      return;
    }
    
    setSelectedPatient(patient);
    setNewRecord({
      diagnosis: '',
      treatment: '',
      notes: '',
      medications: [],
      vital_signs: {
        temperature: '',
        blood_pressure: '',
        heart_rate: '',
        respiratory_rate: '',
        oxygen_saturation: ''
      },
      follow_up_date: '',
      is_active: true
    });
    setMedicationInput('');
    setFormError('');
    setFormTouched({});
    setShowNewRecordModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Mark field as touched
    setFormTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    if (name.includes('vital_signs.')) {
      // Handle nested vital signs fields
      const vitalSignField = name.split('.')[1];
      setNewRecord(prev => ({
        ...prev,
        vital_signs: {
          ...prev.vital_signs,
          [vitalSignField]: value
        }
      }));
    } else if (name === 'is_active') {
      // Handle boolean checkbox
      setNewRecord(prev => ({ ...prev, [name]: e.target.checked }));
    } else {
      // Handle regular fields
      setNewRecord(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handler for edit record form input changes
  const handleEditRecordChange = (e) => {
    const { name, value } = e.target;
    
    // Mark field as touched
    setEditFormTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    if (name.includes('vital_signs.')) {
      // Handle nested vital signs fields
      const vitalSignField = name.split('.')[1];
      setEditRecordData(prev => ({
        ...prev,
        vital_signs: {
          ...prev.vital_signs,
          [vitalSignField]: value
        }
      }));
    } else if (name === 'is_active') {
      // Handle boolean checkbox
      setEditRecordData(prev => ({ ...prev, [name]: e.target.checked }));
    } else {
      // Handle regular fields
      setEditRecordData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Function to handle JSON data input for medical history
  const handleJSONDataInput = (e, isEdit = false) => {
    try {
      const jsonData = JSON.parse(e.target.value);
      
      if (isEdit) {
        setEditRecordData(prev => ({
          ...prev,
          ...jsonData
        }));
      } else {
        setNewRecord(prev => ({
          ...prev,
          ...jsonData
        }));
      }
      
      // Clear any previous errors
      if (isEdit) {
        setEditRecordError('');
      } else {
        setFormError('');
      }
    } catch (err) {
      // Invalid JSON
      if (isEdit) {
        setEditRecordError('Invalid JSON format');
      } else {
        setFormError('Invalid JSON format');
      }
    }
  };

  // Function to add medication to edit record
  const addEditMedication = () => {
    if (medicationInput.trim()) {
      setEditRecordData(prev => ({
        ...prev,
        medications: [...(prev.medications || []), medicationInput.trim()]
      }));
      setMedicationInput('');
    }
  };
  
  // Function to remove medication from edit record
  const removeEditMedication = (index) => {
    setEditRecordData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const addMedication = () => {
    if (medicationInput.trim()) {
      setNewRecord(prev => ({
        ...prev,
        medications: [...prev.medications, medicationInput.trim()]
      }));
      setMedicationInput('');
    }
  };
  
  const removeMedication = (index) => {
    setNewRecord(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const createMedicalRecord = async (patientId) => {
    // Touch all fields to trigger validation
    const allFieldsTouched = {};
    allFieldsTouched['diagnosis'] = true;
    setFormTouched(allFieldsTouched);
    
    if (!newRecord.diagnosis) {
      setFormError('Diagnosis is required');
      return;
    }
    
    try {
      setSubmitting(true);
      setFormError('');
      
      // Prepare the data for API - convert vital_signs to JSON
      const recordData = {
        ...newRecord,
        doctor_id: user.id,
        patient_id: patientId
      };
      
      const response = await axios.post(`http://localhost:8024/patients/${patientId}/medical-record`, recordData, {
        params: { doctor_id: user.id }
      });
      
      // Log response to help with debugging
      console.log("Create medical record response:", response.data);
      
      // Check for a successful response - HTTP status between 200-299
      if (response.status >= 200 && response.status < 300) {
        // Show immediate success toast
        toast.success('Medical record added successfully!', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          className: "bg-white dark:bg-slate-800 shadow-xl",
          bodyClassName: "text-slate-700 dark:text-slate-200",
          progressClassName: "bg-emerald-500 dark:bg-emerald-400"
        });
        
        // Set success message state
        setOperationSuccess('Medical record added successfully');
        
        // Reset form
        setNewRecord({
          diagnosis: '',
          treatment: '',
          notes: '',
          medications: [],
          vital_signs: {
            temperature: '',
            blood_pressure: '',
            heart_rate: '',
            respiratory_rate: '',
            oxygen_saturation: ''
          },
          follow_up_date: '',
          is_active: true
        });
        setMedicationInput('');
        
        // Close modal after a small delay to ensure toast is visible
        setTimeout(() => {
          setShowNewRecordModal(false);
        }, 300);
      } else {
        setFormError('Failed to create record');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
      setFormError(`Error creating medical record: ${errorMessage}`);
      console.error('Error creating medical record:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper functions for medical record view
  const handlePrintRecord = (record) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site to print records.');
      return;
    }
  
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medical Record - ${record.id}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            line-height: 1.5;
            color: #334155;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }
          .header { 
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #e2e8f0; 
            padding-bottom: 1rem;
            margin-bottom: 2rem;
          }
          .logo {
            font-weight: bold;
            font-size: 1.5rem;
            color: #0284c7;
          }
          h1 { font-size: 1.5rem; margin: 0 0 0.5rem 0; color: #0f172a; }
          h2 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem 0; color: #0f172a; }
          .meta { font-size: 0.875rem; color: #64748b; }
          .section {
            margin-bottom: 1.5rem;
            padding: 1rem;
            background-color: #f8fafc;
            border-radius: 0.5rem;
            border: 1px solid #e2e8f0;
          }
          .label { font-weight: 600; margin-bottom: 0.25rem; }
          .grid { 
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
          }
          .medication {
            display: flex;
            align-items: center;
            padding: 0.5rem 0;
          }
          .medication:before {
            content: "•";
            color: #0ea5e9;
            font-weight: bold;
            margin-right: 0.5rem;
          }
          .vital {
            padding: 0.5rem;
            background: white;
            border-radius: 0.25rem;
            border: 1px solid #e2e8f0;
          }
          .footer {
            margin-top: 2rem;
            font-size: 0.75rem;
            text-align: center;
            color: #94a3b8;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">HealthcareMD</div>
          <div class="meta">
            Record ID: ${record.id}<br>
            Created: ${new Date(record.created_at).toLocaleString()}
          </div>
        </div>
        
        <h1>${record.diagnosis}</h1>
        
        <div class="section">
          <div class="label">Diagnosis</div>
          <div>${record.diagnosis}</div>
        </div>
        
        ${record.treatment ? `
        <div class="section">
          <div class="label">Treatment</div>
          <div>${record.treatment}</div>
        </div>
        ` : ''}
        
        ${record.notes ? `
        <div class="section">
          <div class="label">Notes</div>
          <div>${record.notes}</div>
        </div>
        ` : ''}
        
        ${record.medications && record.medications.length > 0 ? `
        <div class="section">
          <div class="label">Medications</div>
          ${record.medications.map(med => `<div class="medication">${med}</div>`).join('')}
        </div>
        ` : ''}
        
        ${record.vital_signs && Object.values(record.vital_signs).some(v => v) ? `
        <div class="section">
          <div class="label">Vital Signs</div>
          <div class="grid">
            ${record.vital_signs.temperature ? `
            <div class="vital">
              <div class="label">Temperature</div>
              <div>${record.vital_signs.temperature} °C</div>
            </div>
            ` : ''}
            ${record.vital_signs.blood_pressure ? `
            <div class="vital">
              <div class="label">Blood Pressure</div>
              <div>${record.vital_signs.blood_pressure} mmHg</div>
            </div>
            ` : ''}
            ${record.vital_signs.heart_rate ? `
            <div class="vital">
              <div class="label">Heart Rate</div>
              <div>${record.vital_signs.heart_rate} bpm</div>
            </div>
            ` : ''}
            ${record.vital_signs.respiratory_rate ? `
            <div class="vital">
              <div class="label">Respiratory Rate</div>
              <div>${record.vital_signs.respiratory_rate} breaths/min</div>
            </div>
            ` : ''}
            ${record.vital_signs.oxygen_saturation ? `
            <div class="vital">
              <div class="label">Oxygen Saturation</div>
              <div>${record.vital_signs.oxygen_saturation}%</div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}
        
        ${record.follow_up_date ? `
        <div class="section">
          <div class="label">Follow-up Date</div>
          <div>${new Date(record.follow_up_date).toLocaleDateString()}</div>
        </div>
        ` : ''}
        
        <div class="section">
          <div class="label">Provider Information</div>
          <div>${record.doctor_name || 'Unknown Provider'}</div>
        </div>
        
        <div class="footer">
          This record was printed on ${new Date().toLocaleString()}<br>
          CONFIDENTIAL MEDICAL RECORD - For authorized use only
        </div>
        
        <button class="no-print" style="position: fixed; top: 20px; right: 20px; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer;" onclick="window.print()">Print Record</button>
      </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Track print action
    try {
      console.log(`Record print initiated: Patient ${record.patient_id}, Record ${record.id}`);
    } catch (error) {
      console.error('Analytics error:', error);
    }
  };
  
  const handleAddToCalendar = (record) => {
    if (!record.follow_up_date) return;
  
    const followUpDate = new Date(record.follow_up_date);
    const endTime = new Date(followUpDate);
    endTime.setHours(followUpDate.getHours() + 1);
  
    // Format dates for calendar URL
    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, "");
    };
  
    // Create calendar event data
    const eventDetails = {
      start: formatDate(followUpDate),
      end: formatDate(endTime),
      title: `Follow-up: ${record.diagnosis}`,
      details: `Follow-up appointment for: ${record.diagnosis}\n\nTreatment: ${record.treatment || 'N/A'}\n\nNotes: ${record.notes || 'N/A'}`,
      location: "Healthcare Clinic"
    };
  
    // Generate Google Calendar URL
    const googleCalendarUrl = 
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventDetails.title)}&dates=${eventDetails.start}/${eventDetails.end}&details=${encodeURIComponent(eventDetails.details)}&location=${encodeURIComponent(eventDetails.location)}&sf=true&output=xml`;
  
    window.open(googleCalendarUrl, '_blank');
    
    toast.success('Opening Google Calendar. Please complete the event details.', {
      position: "top-right",
      autoClose: 3000
    });
  };
  
  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
  };
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  const tableRowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -10, transition: { duration: 0.2 } }
  };
  
  // Error UI
  if (error && allPatients.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md w-full relative"
        >
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/70 dark:border-slate-700/50 p-8 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
            <div className="flex items-center text-red-600 dark:text-red-400 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-4 flex-shrink-0 shadow-md">
                <FiAlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Connection Error</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">We couldn't connect to the server</p>
              </div>
            </div>
            <p className="text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">{error}</p>
            <motion.button 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fetchAllPatients()}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center font-medium"
            >
              <FiRefreshCw className="mr-2" /> Retry Connection
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Add a subtle geometric pattern */}
      <div className="absolute inset-0 bg-repeat opacity-[0.015] pointer-events-none dark:opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%235D5CDE' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")` }}></div>

      {/* Animated network gradient background for high-end look */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-10 dark:opacity-20">
          <svg className="absolute w-full h-full" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#2dd4bf" />
              </linearGradient>
              <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <circle cx="400" cy="400" r="200" stroke="url(#blueGradient)" strokeWidth="1.5" fill="none" className="animate-pulse-slow" />
            <circle cx="400" cy="400" r="300" stroke="url(#purpleGradient)" strokeWidth="1" fill="none" strokeDasharray="50,10" className="animate-spin-slow" />
            <g className="animate-float">
              {[...Array(15)].map((_, i) => {
                const angle = (i / 15) * Math.PI * 2;
                const x = 400 + Math.cos(angle) * (150 + i * 10);
                const y = 400 + Math.sin(angle) * (150 + i * 10);
                return (
                  <circle key={i} cx={x} cy={y} r="3" fill={i % 2 ? "url(#blueGradient)" : "url(#purpleGradient)"} />
                );
              })}
            </g>
            <path d="M400,200 C500,300 600,400 400,600 C200,400 300,300 400,200" stroke="url(#blueGradient)" strokeWidth="0.5" fill="none" />
          </svg>
        </div>
      </div>

      {/* Toast notifications container */}
      <ToastContainer 
        position="top-right" 
        theme={isDarkMode ? 'dark' : 'light'} 
        toastClassName="rounded-xl shadow-xl" 
      />
      
      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 relative z-10">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="space-y-6"
        >
          {/* Success notification */}
          <AnimatePresence>
            {operationSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="bg-emerald-50/80 dark:bg-emerald-900/20 backdrop-blur-lg p-4 rounded-2xl shadow-xl border border-emerald-200/70 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 flex items-center"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center mr-4 flex-shrink-0 shadow-sm">
                  <FiCheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-emerald-800 dark:text-emerald-300">Success</h4>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{operationSuccess}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        
          {/* Main card with patient list */}
          <motion.div 
            variants={fadeInUp}
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 transition-all duration-200 overflow-hidden"
          >
            {/* Hero section with header and intro */}
            <div className="relative overflow-hidden">
              {/* Animated Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-teal-500/5 to-purple-500/5 dark:from-blue-900/10 dark:via-teal-900/10 dark:to-purple-900/10 animate-gradient-shift"></div>
              
              {/* Radial Gradient Overlay */}
              <div className="absolute inset-0 opacity-30 dark:opacity-40 pointer-events-none" 
                style={{ 
                  background: 'radial-gradient(circle at 50% 80%, rgba(56, 189, 248, 0.08), transparent 65%), radial-gradient(circle at 10% 30%, rgba(16, 185, 129, 0.05), transparent 40%)' 
                }}></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 relative z-10">
                <div className="mb-6 md:mb-0">
                  <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-700 via-teal-600 to-purple-700 dark:from-blue-400 dark:via-teal-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">My Patients</h1>
                  <p className="text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">Comprehensive patient management portal for medical records, treatments, and healthcare coordination.</p>
                </div>
                
                <div className="flex items-center space-x-5">
                  {/* Notification center with callbacks */}
                  <NotificationCenter 
                    doctor_id={user?.id} 
                    onNewPatientAssigned={handleNewPatientAssigned}
                    onViewPatientDetails={handleViewPatientDetails}
                  />
                  
                  <div className="hidden md:flex items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm py-2 px-4 rounded-full shadow-sm border border-slate-200/70 dark:border-slate-700/50">
                    <div className="mr-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white font-semibold text-base shadow-md">
                        {user?.name?.charAt(0) || 'D'}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">Welcome back,</span>
                      <span className="font-semibold text-slate-800 dark:text-white">{user?.name || 'Doctor'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recent Patients Cards Section */}
            {recentlyAssignedPatients.length > 0 && (
              <div className="px-6 md:px-8">
                <RecentPatientCards 
                  patients={recentlyAssignedPatients} 
                  onViewPatientDetails={handleViewPatientDetails}
                  getInitials={getInitials}
                  getFullName={getFullName}
                />
              </div>
            )}
            
            {/* Search Section */}
            <div className="px-6 md:px-8">
              <motion.div variants={fadeInUp} className="mb-6">
                <div className="relative flex-grow max-w-3xl mx-auto">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiSearch className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search patients by name, email, phone, or registration..." 
                    className="pl-11 pr-4 py-3.5 w-full border border-slate-200/70 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/70 focus:border-transparent text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm transition-all duration-200 shadow-sm hover:shadow-md placeholder-slate-400/80 dark:placeholder-slate-500/80 text-base font-normal"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search patients"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400 transition-colors"
                      aria-label="Clear search"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
            
            {/* Patients Table Section */}
            <div className="px-4 md:px-6 lg:px-8 pb-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/50 transition-all duration-200 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-sm">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  <table className="min-w-full divide-y divide-slate-200/70 dark:divide-slate-700/50">
                    <thead className="bg-slate-50/90 dark:bg-slate-700/30 backdrop-blur-sm">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Patient
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Age
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Gender
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Contact
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm divide-y divide-slate-200/70 dark:divide-slate-700/50">
                      {paginatedPatients.length > 0 ? (
                        paginatedPatients.map((patient, idx) => {
                          const fullName = getFullName(patient);
                          const hasCompleteProfile = Boolean(patient.first_name || patient.last_name || patient.email || patient.phone_number);
                          
                          return (
                            <motion.tr 
                              key={patient.id} 
                              className={`group hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all duration-200 ${
                                patient.isNew ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                              }`}
                              variants={tableRowVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              transition={{ delay: idx * 0.03, duration: 0.2 }}
                              whileHover={{ backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.3)' : 'rgba(248, 250, 252, 0.8)' }}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-11 w-11 relative">
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 animate-pulse-slow shadow-md"></div>
                                    <div className="absolute inset-[2px] rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center">
                                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {getInitials(patient)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="flex items-center">
                                      <div className="text-base font-medium text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">{fullName}</div>
                                      {patient.isNew && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs rounded-full font-medium">
                                          NEW
                                        </span>
                                      )}
                                    </div>
                                    {patient.registration_number && (
                                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">#{patient.registration_number}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {calculateAge(patient.date_of_birth)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                  {patient.gender || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{patient.phone_number || 'No Phone'}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{patient.email || 'No Email'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 inline-flex text-xs font-medium rounded-full ${
                                  hasCompleteProfile 
                                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200/70 dark:border-teal-800/30' 
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/30'
                                }`}>
                                  {hasCompleteProfile ? 'Active' : 'Incomplete'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end space-x-1">
                                  <motion.button 
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-150 shadow-sm hover:shadow" 
                                    title="View patient details"
                                    onClick={() => viewPatientDetails(patient.id)}
                                    aria-label="View patient details"
                                  >
                                    <FiEye className="w-5 h-5" />
                                  </motion.button>
                                  <motion.button 
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="p-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-150 shadow-sm hover:shadow" 
                                    title="View medical records"
                                    onClick={() => fetchPatientRecords(patient.id)}
                                    aria-label="View medical records"
                                  >
                                    <FiList className="w-5 h-5" />
                                  </motion.button>
                                  <motion.button 
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="p-2 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 rounded-full hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all duration-150 shadow-sm hover:shadow" 
                                    title="Add medical record"
                                    onClick={() => openAddMedicalRecord(patient)}
                                    aria-label="Add medical record"
                                  >
                                    <FiFileText className="w-5 h-5" />
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-16 text-center">
                            {loading ? (
                              <div className="flex flex-col items-center justify-center">
                                <svg className="animate-spin h-12 w-12 text-blue-500 dark:text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="text-slate-500 dark:text-slate-400 text-base">Loading patients...</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4 shadow-inner">
                                  <FiUser className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No patients found</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto text-center leading-relaxed">
                                  {searchTerm ? `No patients match "${searchTerm}". Try a different search term.` : "No patients found. New patient assignments will appear here."}
                                </p>
                                {searchTerm && (
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    className="px-4 py-2.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-150 flex items-center shadow-sm hover:shadow"
                                    onClick={() => setSearchTerm('')}
                                  >
                                    <FiX className="mr-2" />
                                    Clear search
                                  </motion.button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="bg-slate-50/80 dark:bg-slate-800/90 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-t border-slate-200/70 dark:border-slate-700/50">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{paginatedPatients.length}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPatients}</span> patients
                  </p>
                  {totalPatients > patientsPerPage && (
                    <div className="flex items-center space-x-1.5">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`p-2 rounded-lg border ${
                          currentPage === 1 
                            ? 'border-slate-200/70 dark:border-slate-700/50 text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                            : 'border-slate-200/70 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-blue-500 dark:hover:text-blue-400 shadow-sm hover:shadow'
                        }`}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </motion.button>
                      {Array.from({ length: Math.min(Math.ceil(totalPatients / patientsPerPage), 5) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <motion.button 
                            key={`page-${pageNum}`}
                            whileHover={{ scale: 1.05, y: -1 }}
                            whileTap={{ scale: 0.95 }}
                            className={`p-2 w-10 h-10 flex items-center justify-center rounded-lg shadow-sm ${
                              currentPage === pageNum 
                                ? 'bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-medium' 
                                : 'border border-slate-200/70 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                            }`}
                            onClick={() => setCurrentPage(pageNum)}
                            aria-label={`Page ${pageNum}`}
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                          >
                            {pageNum}
                          </motion.button>
                        );
                      })}
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`p-2 rounded-lg border ${
                          currentPage === Math.ceil(totalPatients / patientsPerPage) 
                            ? 'border-slate-200/70 dark:border-slate-700/50 text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                            : 'border-slate-200/70 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-blue-500 dark:hover:text-blue-400 shadow-sm hover:shadow'
                        }`}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalPatients / patientsPerPage)))}
                        disabled={currentPage === Math.ceil(totalPatients / patientsPerPage)}
                        aria-label="Next page"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Patient Details Modal */}
          <AnimatePresence>
            {showDetailsModal && selectedPatient && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/70 dark:border-slate-700/50 w-full max-w-3xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/90 to-teal-50/90 dark:from-blue-900/20 dark:to-teal-900/20 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Patient Details</h2>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowDetailsModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm"
                      aria-label="Close modal"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Loading state */}
                  {loadingDetails ? (
                    <div className="p-8 flex flex-col items-center justify-center">
                      <svg className="animate-spin h-14 w-14 text-blue-500 dark:text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-slate-600 dark:text-slate-400 text-lg">Loading patient details...</p>
                    </div>
                  ) : detailsError ? (
                    <div className="p-8 text-center">
                      <div className="w-16 h-16 mx-auto flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full mb-4">
                        <FiAlertCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Error Loading Details</h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-6">{detailsError}</p>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowDetailsModal(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm"
                      >
                        Close
                      </motion.button>
                    </div>
                  ) : (
                    <>
                      {/* Patient info */}
                      <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-start mb-8">
                          {/* Patient avatar and basic info */}
                          <div className="flex items-center md:items-start mb-6 md:mb-0 md:mr-8">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white text-xl font-semibold shadow-lg relative overflow-hidden">
                              <span className="relative z-10">{getInitials(selectedPatient)}</span>
                              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzR2LTRoLTJ2NGgtNHYyaDR2NGgydi00aDR2LTJoLTR6bTAtMzBWMGgtMnY0aC00djJoNHY0aDJWNmg0VjRoLTR6TTYgMzR2LTRINHY0SDB2Mmg0djRoMnYtNGg0di0ySDZ6TTYgNFYwSDR2NEgwdjJoNHY0aDJWNmg0VjRINnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20 mix-blend-overlay"></div>
                            </div>
                            <div className="ml-6 md:ml-0 md:mt-4">
                              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{getFullName(selectedPatient)}</h3>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {selectedPatient.gender && (
                                  <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium shadow-sm">
                                    {selectedPatient.gender}
                                  </span>
                                )}
                                {selectedPatient.date_of_birth && (
                                  <span className="px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 rounded-full text-xs font-medium shadow-sm">
                                    {calculateAge(selectedPatient.date_of_birth)} years
                                  </span>
                                )}
                                {selectedPatient.registration_number && (
                                  <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium shadow-sm">
                                    #{selectedPatient.registration_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                          <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center">
                              <FiUser className="mr-2 text-blue-500 dark:text-blue-400" /> Contact Information
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Email</p>
                                <p className="text-slate-900 dark:text-white font-medium">
                                  {selectedPatient.email ? (
                                    <a href={`mailto:${selectedPatient.email}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                      {selectedPatient.email}
                                    </a>
                                  ) : 'Not provided'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Phone</p>
                                <p className="text-slate-900 dark:text-white font-medium">
                                  {selectedPatient.phone_number ? (
                                    <a href={`tel:${selectedPatient.phone_number}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                      {selectedPatient.phone_number}
                                    </a>
                                  ) : 'Not provided'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Address</p>
                                <p className="text-slate-900 dark:text-white font-medium">{selectedPatient.address || 'Not provided'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Emergency Contact</p>
                                <p className="text-slate-900 dark:text-white font-medium">
                                  {selectedPatient.emergency_contact_name ? 
                                    <span>
                                      {selectedPatient.emergency_contact_name}
                                      {selectedPatient.emergency_contact_phone && (
                                        <span> • <a href={`tel:${selectedPatient.emergency_contact_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                          {selectedPatient.emergency_contact_phone}
                                        </a></span>
                                      )}
                                    </span> : 
                                    'Not provided'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center">
                              <FiActivity className="mr-2 text-teal-500 dark:text-teal-400" /> Medical Information
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Blood Group</p>
                                <p className="text-slate-900 dark:text-white font-medium">
                                  {selectedPatient.blood_group && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-red-100/70 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200/60 dark:border-red-800/30 shadow-sm">
                                      <FiHeart className="mr-1.5 text-red-500 dark:text-red-400" /> {selectedPatient.blood_group}
                                    </span>
                                  ) || 'Not recorded'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Allergies</p>
                                <div className="text-slate-900 dark:text-white font-medium">
                                  {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {selectedPatient.allergies.map((allergy, index) => (
                                        <span key={index} className="px-2.5 py-1 bg-red-100/70 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-full text-xs border border-red-200/60 dark:border-red-800/30 shadow-sm">
                                          {allergy}
                                        </span>
                                      ))}
                                    </div>
                                  ) : 'None recorded'}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Registered Since</p>
                                <p className="text-slate-900 dark:text-white font-medium flex items-center">
                                  <FiCalendar className="mr-1.5 text-blue-500 dark:text-blue-400" /> 
                                  {selectedPatient.created_at ? formatDate(selectedPatient.created_at) : 'Not available'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-slate-200/70 dark:border-slate-700/50">
                          <motion.button
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setShowDetailsModal(false);
                              fetchPatientRecords(selectedPatient.id);
                            }}
                            className="px-4 py-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 flex items-center shadow-sm hover:shadow"
                          >
                            <FiList className="mr-2" /> View Medical Records
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setShowDetailsModal(false);
                              openAddMedicalRecord(selectedPatient);
                            }}
                            className="px-4 py-2.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-xl hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-all duration-200 flex items-center shadow-sm hover:shadow"
                          >
                            <FiFileText className="mr-2" /> Add Medical Record
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setShowDetailsModal(false)}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow"
                          >
                            Close
                          </motion.button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Medical Records List Modal */}
          <AnimatePresence>
            {showMedicalRecordsModal && selectedPatient && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/70 dark:border-slate-700/50 w-full max-w-4xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/90 to-teal-50/90 dark:from-blue-900/20 dark:to-teal-900/20 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center">
                        <FiFileText className="mr-2 text-blue-500 dark:text-blue-400" /> Medical Records
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{getFullName(selectedPatient)}</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowMedicalRecordsModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm"
                      aria-label="Close modal"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {/* Loading state */}
                    {loadingRecords ? (
                      <div className="py-16 flex flex-col items-center justify-center">
                        <svg className="animate-spin h-14 w-14 text-blue-500 dark:text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">Loading medical records...</p>
                      </div>
                    ) : recordsError ? (
                      <div className="py-16 text-center">
                        <div className="w-16 h-16 mx-auto flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full mb-4 shadow-md">
                          <FiAlertCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">Error Loading Records</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">{recordsError}</p>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setShowMedicalRecordsModal(false)}
                          className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors shadow-sm"
                        >
                          Close
                        </motion.button>
                      </div>
                    ) : (
                      <>
                        {/* No records state */}
                        {patientRecords.length === 0 ? (
                          <div className="py-16 text-center">
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.5 }}
                            >
                              <div className="w-20 h-20 mx-auto flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-full mb-4 shadow-md">
                                <FiFileText className="w-10 h-10" />
                              </div>
                              <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-2">No Medical Records</h3>
                              <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
                                This patient doesn't have any medical records yet. You can create the first record.
                              </p>
                              <div className="flex justify-center">
                                <motion.button
                                  whileHover={{ scale: 1.05, y: -2 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    setShowMedicalRecordsModal(false);
                                    openAddMedicalRecord(selectedPatient);
                                  }}
                                  className="px-5 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center font-medium"
                                >
                                  <FiPlus className="mr-2" /> Add Medical Record
                                </motion.button>
                              </div>
                            </motion.div>
                          </div>
                        ) : (
                          <>
                            {/* Records list */}
                            <div className="mb-6 flex justify-between items-center">
                              <h3 className="text-lg font-medium text-slate-800 dark:text-white flex items-center">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-semibold mr-2">
                                  {patientRecords.length}
                                </span>
                                {patientRecords.length === 1 ? 'Record' : 'Records'}
                              </h3>
                              <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setShowMedicalRecordsModal(false);
                                  openAddMedicalRecord(selectedPatient);
                                }}
                                className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 flex items-center text-sm shadow-sm hover:shadow"
                              >
                                <FiPlus className="mr-1.5" /> Add Record
                              </motion.button>
                            </div>
                            
                            <div className="space-y-4 overflow-y-auto max-h-[28rem] pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                              {patientRecords.map((record, index) => (
                                <motion.div
                                  key={record.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3, delay: index * 0.05 }}
                                  className="group p-5 bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-700/50 hover:shadow-md transition-all duration-200 relative overflow-hidden"
                                >
                                  {/* Hover effect gradient */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-teal-500/5 dark:from-blue-500/10 dark:to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                  
                                  <div className="flex justify-between items-start mb-3 relative">
                                    <div>
                                      <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">{record.diagnosis}</h4>
                                      <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center mt-1">
                                        <FiCalendar className="w-3.5 h-3.5 mr-1 text-blue-500/70 dark:text-blue-400/70" />
                                        {formatDate(record.created_at)}
                                      </p>
                                    </div>
                                    <div className="flex space-x-2">
                                      <motion.button
                                        whileHover={{ scale: 1.1, y: -2 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => viewMedicalRecord(selectedPatient.id, record.id)}
                                        className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors shadow-sm"
                                        title="View record details"
                                        aria-label="View record details"
                                      >
                                        <FiEye className="w-4 h-4" />
                                      </motion.button>
                                      <motion.button
                                        whileHover={{ scale: 1.1, y: -2 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => openEditRecord(record)}
                                        className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors shadow-sm"
                                        title="Edit record"
                                        aria-label="Edit record"
                                      >
                                        <FiEdit className="w-4 h-4" />
                                      </motion.button>
                                    </div>
                                  </div>
                                  <div className="mt-2 relative">
                                    {record.treatment && (
                                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">
                                        <span className="font-medium text-slate-900 dark:text-slate-100">Treatment:</span> {record.treatment}
                                      </p>
                                    )}
                                    {record.medications && record.medications.length > 0 && (
                                      <div className="mt-3">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase flex items-center">
                                          <FiActivity className="w-3.5 h-3.5 mr-1 text-teal-500/70 dark:text-teal-400/70" /> Medications
                                        </span>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                          {record.medications.slice(0, 3).map((med, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2.5 py-1 bg-teal-100/70 dark:bg-teal-900/20 text-teal-800 dark:text-teal-300 rounded-full text-xs font-medium shadow-sm"
                                            >
                                              {med}
                                            </span>
                                          ))}
                                          {record.medications.length > 3 && (
                                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-600/50 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium shadow-sm">
                                              +{record.medications.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        {/* Footer */}
                        <div className="flex justify-end mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-700/50">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setShowMedicalRecordsModal(false)}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow"
                          >
                            Close
                          </motion.button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* View Medical Record Modal */}
          <AnimatePresence>
            {showViewRecordModal && selectedRecord && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/70 dark:border-slate-700/50 w-full max-w-3xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/90 to-teal-50/90 dark:from-blue-900/20 dark:to-teal-900/20 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center">
                      <FiFileText className="mr-2 text-blue-500 dark:text-blue-400" /> Medical Record
                    </h2>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handlePrintRecord(selectedRecord)}
                        className="p-1.5 rounded-full bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors shadow-sm"
                        title="Print record"
                        aria-label="Print record"
                      >
                        <FiPrinter className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowViewRecordModal(false)}
                        className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm"
                        aria-label="Close modal"
                      >
                        <FiX className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {/* Record ID and Created info */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">{selectedRecord.diagnosis}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                          <span className="flex items-center">
                            <FiCalendar className="w-3.5 h-3.5 mr-1.5 text-blue-500/70 dark:text-blue-400/70" /> 
                            {formatDate(selectedRecord.created_at)}
                          </span>
                          <span className="flex items-center">
                            <FiClock className="w-3.5 h-3.5 mr-1.5 text-blue-500/70 dark:text-blue-400/70" />
                            {new Date(selectedRecord.created_at).toLocaleTimeString()}
                          </span>
                          <span className="flex items-center">
                            <FiInfo className="w-3.5 h-3.5 mr-1.5 text-blue-500/70 dark:text-blue-400/70" />
                            ID: {selectedRecord.id.substring(0,8)}...
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 sm:mt-0">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          selectedRecord.is_active 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {selectedRecord.is_active ? 'Active' : 'Archived'}
                        </span>
                      </div>
                    </div>

                    {/* Diagnosis & Treatment */}
                    <div className="space-y-5 mb-8">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                          <span className="w-1 h-4 bg-blue-500 dark:bg-blue-400 rounded-full mr-2"></span>
                          Diagnosis
                        </h4>
                        <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl text-slate-800 dark:text-slate-200 whitespace-pre-wrap border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                          {selectedRecord.diagnosis}
                        </div>
                      </div>
                      
                      {selectedRecord.treatment && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                            <span className="w-1 h-4 bg-teal-500 dark:bg-teal-400 rounded-full mr-2"></span>
                            Treatment
                          </h4>
                          <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl text-slate-800 dark:text-slate-200 whitespace-pre-wrap border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                            {selectedRecord.treatment}
                          </div>
                        </div>
                      )}
                      
                      {selectedRecord.notes && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                            <span className="w-1 h-4 bg-purple-500 dark:bg-purple-400 rounded-full mr-2"></span>
                            Notes
                          </h4>
                          <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl text-slate-800 dark:text-slate-200 whitespace-pre-wrap border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                            {selectedRecord.notes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Medications */}
                    {selectedRecord.medications && selectedRecord.medications.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                          <FiActivity className="mr-2 text-teal-500 dark:text-teal-400" /> Medications
                        </h4>
                        <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {selectedRecord.medications.map((med, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: idx * 0.05 }}
                                className="flex items-center text-slate-800 dark:text-slate-200 px-3 py-2 bg-white/60 dark:bg-slate-800/40 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                              >
                                <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 mr-3 flex-shrink-0"></span>
                                <span className="font-medium">{med}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Vital Signs */}
                    {selectedRecord.vital_signs && Object.values(selectedRecord.vital_signs).some(v => v) && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                          <FiActivity className="mr-2 text-purple-500 dark:text-purple-400" /> Vital Signs
                        </h4>
                        <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl grid grid-cols-2 md:grid-cols-3 gap-4 border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                          {selectedRecord.vital_signs.temperature && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/50 dark:border-slate-700/30">
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Temperature</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5"></span>
                                {selectedRecord.vital_signs.temperature} °C
                              </p>
                            </div>
                          )}
                          {selectedRecord.vital_signs.blood_pressure && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/50 dark:border-slate-700/30">
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Blood Pressure</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"></span>
                                {selectedRecord.vital_signs.blood_pressure} mmHg
                              </p>
                            </div>
                          )}
                          {selectedRecord.vital_signs.heart_rate && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/50 dark:border-slate-700/30">
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Heart Rate</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5"></span>
                                {selectedRecord.vital_signs.heart_rate} bpm
                              </p>
                            </div>
                          )}
                          {selectedRecord.vital_signs.respiratory_rate && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/50 dark:border-slate-700/30">
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Respiratory Rate</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-1.5"></span>
                                {selectedRecord.vital_signs.respiratory_rate} breaths/min
                              </p>
                            </div>
                          )}
                          {selectedRecord.vital_signs.oxygen_saturation && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200/50 dark:border-slate-700/30">
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Oxygen Saturation</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                                {selectedRecord.vital_signs.oxygen_saturation}%
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Follow Up Date */}
                    {selectedRecord.follow_up_date && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                          <FiCalendar className="mr-2 text-blue-500 dark:text-blue-400" /> Follow-up Date
                        </h4>
                        <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="px-3 py-2 bg-blue-100/80 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg flex items-center shadow-sm">
                              <FiCalendar className="mr-2 text-blue-500 dark:text-blue-400" />
                              {formatDate(selectedRecord.follow_up_date)}
                            </div>
                            
                            {/* Days remaining calculation */}
                            {(() => {
                              const today = new Date();
                              const followUpDate = new Date(selectedRecord.follow_up_date);
                              const diffTime = followUpDate.getTime() - today.getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              
                              let statusClass = "";
                              let statusText = "";
                              
                              if (diffDays < 0) {
                                statusClass = "bg-red-100/80 dark:bg-red-900/30 text-red-800 dark:text-red-300";
                                statusText = `${Math.abs(diffDays)} days overdue`;
                              } else if (diffDays === 0) {
                                statusClass = "bg-amber-100/80 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
                                statusText = "Today";
                              } else if (diffDays <= 3) {
                                statusClass = "bg-amber-100/80 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
                                statusText = `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                              } else {
                                statusClass = "bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300";
                                statusText = `In ${diffDays} days`;
                              }
                              
                              return (
                                <div className={`px-3 py-2 rounded-lg shadow-sm flex items-center ${statusClass}`}>
                                  <FiClock className="mr-2" />
                                  {statusText}
                                </div>
                              );
                            })()}
                            
                            {/* Add to calendar button */}
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleAddToCalendar(selectedRecord)}
                              className="ml-auto px-3 py-2 bg-white/80 dark:bg-slate-800/50 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow border border-slate-200/50 dark:border-slate-700/30 transition-all duration-150 flex items-center text-sm"
                            >
                              <FiCalendar className="mr-1.5 text-blue-500/70 dark:text-blue-400/70" />
                              Add to Calendar
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Doctor & Created By Info */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                        <FiUser className="mr-2 text-blue-500 dark:text-blue-400" /> Record Info
                      </h4>
                      <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Created By</p>
                            <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center">
                              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white text-xs mr-2">
                                {selectedRecord.doctor_name?.charAt(0) || 'D'}
                              </span>
                              {selectedRecord.doctor_name || 'Unknown Doctor'}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last Updated</p>
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {selectedRecord.updated_at ? formatDate(selectedRecord.updated_at) : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-6 py-4 border-t border-slate-200/70 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm flex flex-wrap justify-between sm:justify-end gap-3">
                    <motion.button
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setShowViewRecordModal(false);
                        openEditRecord(selectedRecord);
                      }}
                      className="px-4 py-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 flex items-center shadow-sm hover:shadow"
                    >
                      <FiEdit className="mr-2" /> Edit Record
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowViewRecordModal(false)}
                      className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow"
                    >
                      Close
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Edit Medical Record Modal */}
          <AnimatePresence>
            {showEditRecordModal && editRecordData && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/70 dark:border-slate-700/50 w-full max-w-3xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/90 to-teal-50/90 dark:from-blue-900/20 dark:to-teal-900/20 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center">
                      <FiEdit className="mr-2 text-blue-500 dark:text-blue-400" /> Edit Medical Record
                    </h2>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowEditRecordModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm"
                      aria-label="Close modal"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Content */}
                  <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {editRecordError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/70 dark:border-red-800/30 rounded-xl text-red-700 dark:text-red-300 flex items-start shadow-sm"
                      >
                        <FiAlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                        <div>{editRecordError}</div>
                      </motion.div>
                    )}

                    <div className="space-y-5">
                      {/* Diagnosis Field */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">
                          Diagnosis <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="diagnosis"
                          value={editRecordData.diagnosis || ''}
                          onChange={handleEditRecordChange}
                          className={`w-full p-3.5 border ${
                            editFormTouched.diagnosis && !editRecordData.diagnosis
                              ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10'
                              : 'border-slate-300/70 dark:border-slate-600/50 bg-white/80 dark:bg-slate-700/50'
                          } rounded-xl backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm`}
                          rows="3"
                          placeholder="Enter patient diagnosis"
                        ></textarea>
                        {editFormTouched.diagnosis && !editRecordData.diagnosis && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center">
                            <FiAlertCircle className="w-4 h-4 mr-1.5" /> Diagnosis is required
                          </p>
                        )}
                      </div>
                      
                      {/* Treatment Field */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Treatment</label>
                        <textarea
                          name="treatment"
                          value={editRecordData.treatment || ''}
                          onChange={handleEditRecordChange}
                          className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                          rows="3"
                          placeholder="Enter treatment details"
                        ></textarea>
                      </div>
                      
                      {/* Notes Field */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Notes</label>
                        <textarea
                          name="notes"
                          value={editRecordData.notes || ''}
                          onChange={handleEditRecordChange}
                          className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                          rows="3"
                          placeholder="Enter additional notes"
                        ></textarea>
                      </div>
                      
                      {/* Medications */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <FiActivity className="mr-2 text-teal-500 dark:text-teal-400" /> Medications
                        </label>
                        <div className="flex mb-3">
                          <input
                            type="text"
                            value={medicationInput}
                            onChange={(e) => setMedicationInput(e.target.value)}
                            className="flex-grow p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-l-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                            placeholder="Enter medication"
                          />
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            type="button"
                            onClick={addEditMedication}
                            className="px-4 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-r-xl flex items-center justify-center shadow-sm"
                          >
                            <FiPlus className="w-5 h-5" />
                          </motion.button>
                        </div>
                        
                        {/* Medications List */}
                        {editRecordData.medications && editRecordData.medications.length > 0 && (
                          <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                            <ul className="space-y-2">
                              {editRecordData.medications.map((med, idx) => (
                                <motion.li
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -10 }}
                                  transition={{ duration: 0.2 }}
                                  key={idx} 
                                  className="flex justify-between items-center bg-white/80 dark:bg-slate-800/40 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm"
                                >
                                  <span className="text-slate-800 dark:text-slate-200 flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 mr-3 flex-shrink-0"></span>
                                    {med}
                                  </span>
                                  <motion.button
                                    whileHover={{ scale: 1.1, backgroundColor: isDarkMode ? 'rgba(248, 113, 113, 0.2)' : 'rgba(254, 226, 226, 0.8)' }}
                                    whileTap={{ scale: 0.9 }}
                                    type="button"
                                    onClick={() => removeEditMedication(idx)}
                                    className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                    aria-label="Remove medication"
                                  >
                                    <FiMinus className="w-4 h-4" />
                                  </motion.button>
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* Vital Signs */}
                      <div>
                        <label className="block mb-3 font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <FiActivity className="mr-2 text-purple-500 dark:text-purple-400" /> Vital Signs
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Temperature (°C)</label>
                            <input
                              type="text"
                              name="vital_signs.temperature"
                              value={editRecordData.vital_signs?.temperature || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter temperature"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Blood Pressure (mmHg)</label>
                            <input
                              type="text"
                              name="vital_signs.blood_pressure"
                              value={editRecordData.vital_signs?.blood_pressure || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="e.g. 120/80"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Heart Rate (bpm)</label>
                            <input
                              type="text"
                              name="vital_signs.heart_rate"
                              value={editRecordData.vital_signs?.heart_rate || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter heart rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Respiratory Rate (breaths/min)</label>
                            <input
                              type="text"
                              name="vital_signs.respiratory_rate"
                              value={editRecordData.vital_signs?.respiratory_rate || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter respiratory rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Oxygen Saturation (%)</label>
                            <input
                              type="text"
                              name="vital_signs.oxygen_saturation"
                              value={editRecordData.vital_signs?.oxygen_saturation || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter oxygen saturation"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Follow-up Date */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <FiCalendar className="mr-2 text-blue-500 dark:text-blue-400" /> Follow-up Date
                        </label>
                        <input
                          type="date"
                          name="follow_up_date"
                          value={editRecordData.follow_up_date || ''}
                          onChange={handleEditRecordChange}
                          className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                        />
                      </div>

                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200/70 dark:border-slate-700/50">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowEditRecordModal(false)}
                        disabled={updatingRecord}
                        className="px-4 py-2.5 border border-slate-300/70 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={updateMedicalRecord}
                        disabled={updatingRecord}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center"
                      >
                        {updatingRecord ? (
                          <>
                            <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </>
                        ) : (
                          <>
                            <FiSave className="mr-2" /> Save Changes
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Add Medical Record Modal */}
          <AnimatePresence>
            {showNewRecordModal && selectedPatient && (
              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/70 dark:border-slate-700/50 w-full max-w-3xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/90 to-teal-50/90 dark:from-blue-900/20 dark:to-teal-900/20 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center">
                        <FiFileText className="mr-2 text-teal-500 dark:text-teal-400" /> Add Medical Record
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center">
                        <FiUser className="w-3.5 h-3.5 mr-1.5 text-blue-500/70 dark:text-blue-400/70" />
                        {getFullName(selectedPatient)}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowNewRecordModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors shadow-sm"
                      aria-label="Close modal"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Content */}
                  <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {formError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/70 dark:border-red-800/30 rounded-xl text-red-700 dark:text-red-300 flex items-start shadow-sm"
                      >
                        <FiAlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                        <div>{formError}</div>
                      </motion.div>
                    )}

                    <div className="space-y-5">
                      {/* Diagnosis Field */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">
                          Diagnosis <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="diagnosis"
                          value={newRecord.diagnosis}
                          onChange={handleInputChange}
                          className={`w-full p-3.5 border ${
                            formTouched.diagnosis && !newRecord.diagnosis
                              ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10'
                              : 'border-slate-300/70 dark:border-slate-600/50 bg-white/80 dark:bg-slate-700/50'
                          } rounded-xl backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm`}
                          rows="3"
                          placeholder="Enter patient diagnosis"
                        ></textarea>
                        {formTouched.diagnosis && !newRecord.diagnosis && (
                          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center">
                            <FiAlertCircle className="w-4 h-4 mr-1.5" /> Diagnosis is required
                          </p>
                        )}
                      </div>
                      
                      {/* Treatment Field */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Treatment</label>
                        <textarea
                          name="treatment"
                          value={newRecord.treatment}
                          onChange={handleInputChange}
                          className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                          rows="3"
                          placeholder="Enter treatment details"
                        ></textarea>
                      </div>
                      
                      {/* Notes Field */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Notes</label>
                        <textarea
                          name="notes"
                          value={newRecord.notes}
                          onChange={handleInputChange}
                          className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                          rows="3"
                          placeholder="Enter additional notes"
                        ></textarea>
                      </div>
                      
                      {/* Medications */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <FiActivity className="mr-2 text-teal-500 dark:text-teal-400" /> Medications
                        </label>
                        <div className="flex mb-3">
                          <input
                            type="text"
                            value={medicationInput}
                            onChange={(e) => setMedicationInput(e.target.value)}
                            className="flex-grow p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-l-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                            placeholder="Enter medication"
                          />
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            type="button"
                            onClick={addMedication}
                            className="px-4 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-r-xl flex items-center justify-center shadow-sm"
                          >
                            <FiPlus className="w-5 h-5" />
                          </motion.button>
                        </div>
                        
                        {/* Medications List */}
                        {newRecord.medications.length > 0 && (
                          <div className="bg-slate-50/80 dark:bg-slate-700/30 backdrop-blur-sm p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/50 shadow-sm">
                            <ul className="space-y-2">
                              {newRecord.medications.map((med, idx) => (
                                <motion.li
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -10 }}
                                  transition={{ duration: 0.2 }}
                                  key={idx} 
                                  className="flex justify-between items-center bg-white/80 dark:bg-slate-800/40 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm"
                                >
                                  <span className="text-slate-800 dark:text-slate-200 flex items-center">
                                    <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 mr-3 flex-shrink-0"></span>
                                    {med}
                                  </span>
                                  <motion.button
                                    whileHover={{ scale: 1.1, backgroundColor: isDarkMode ? 'rgba(248, 113, 113, 0.2)' : 'rgba(254, 226, 226, 0.8)' }}
                                    whileTap={{ scale: 0.9 }}
                                    type="button"
                                    onClick={() => removeMedication(idx)}
                                    className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                    aria-label="Remove medication"
                                  >
                                    <FiMinus className="w-4 h-4" />
                                  </motion.button>
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* Vital Signs */}
                      <div>
                        <label className="block mb-3 font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <FiActivity className="mr-2 text-purple-500 dark:text-purple-400" /> Vital Signs
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Temperature (°C)</label>
                            <input
                              type="text"
                              name="vital_signs.temperature"
                              value={newRecord.vital_signs.temperature}
                              onChange={handleInputChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter temperature"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Blood Pressure (mmHg)</label>
                            <input
                              type="text"
                              name="vital_signs.blood_pressure"
                              value={newRecord.vital_signs.blood_pressure}
                              onChange={handleInputChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="e.g. 120/80"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Heart Rate (bpm)</label>
                            <input
                              type="text"
                              name="vital_signs.heart_rate"
                              value={newRecord.vital_signs.heart_rate}
                              onChange={handleInputChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter heart rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Respiratory Rate (breaths/min)</label>
                            <input
                              type="text"
                              name="vital_signs.respiratory_rate"
                              value={newRecord.vital_signs.respiratory_rate}
                              onChange={handleInputChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter respiratory rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1.5 text-sm text-slate-600 dark:text-slate-400">Oxygen Saturation (%)</label>
                            <input
                              type="text"
                              name="vital_signs.oxygen_saturation"
                              value={newRecord.vital_signs.oxygen_saturation}
                              onChange={handleInputChange}
                              className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                              placeholder="Enter oxygen saturation"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Follow-up Date */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300 flex items-center">
                          <FiCalendar className="mr-2 text-blue-500 dark:text-blue-400" /> Follow-up Date
                        </label>
                        <input
                          type="date"
                          name="follow_up_date"
                          value={newRecord.follow_up_date}
                          onChange={handleInputChange}
                          className="w-full p-3.5 border border-slate-300/70 dark:border-slate-600/50 rounded-xl bg-white/80 dark:bg-slate-700/50 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/70 dark:focus:ring-blue-400/50 focus:border-transparent text-slate-800 dark:text-slate-200 shadow-sm"
                        />
                      </div>

                    </div>
                    
                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200/70 dark:border-slate-700/50">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowNewRecordModal(false)}
                        disabled={submitting}
                        className="px-4 py-2.5 border border-slate-300/70 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => createMedicalRecord(selectedPatient.id)}
                        disabled={submitting}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center"
                      >
                        {submitting ? (
                          <>
                            <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            <FiSave className="mr-2" /> Save Record
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      
      {/* Custom CSS animations */}
      <style jsx>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animate-gradient-shift {
          background-size: 400% 400%;
          animation: gradient-shift 8s ease infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 9999px;
        }
        
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #334155;
        }
        
        .animate-spin-slow {
          animation: spin 30s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
};

export default PatientManagement;
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  FiSearch, FiFilter, FiUser, FiEdit, FiFileText, FiSave, 
  FiAlertCircle, FiCheckCircle, FiEye, FiPlus, FiMinus, 
  FiList, FiCalendar, FiX, FiClock, FiActivity, FiRefreshCw,
  FiInfo, FiSliders, FiTrendingUp, FiShield, FiHeart, FiSettings,
  FiBell, FiMessageSquare
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
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log the error to an error reporting service
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', info.componentStack);
    
    // We can use captureOwnerStack in development
    if (process.env.NODE_ENV !== 'production' && React.captureOwnerStack) {
      console.debug('Owner stack:', React.captureOwnerStack());
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return this.props.fallback || (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          <h3 className="font-medium">Something went wrong</h3>
          <p className="text-sm mt-1">The notification system encountered an error.</p>
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

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (notificationSoundRef.current && userInteracted) {
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
      transition: { duration: 0.8 }
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
    
    // For patient assignments, we want to log more details but accept more types of data
    if (data.event === 'patient_assigned') {
      // For debugging: log details about the patient data
      console.log('Patient data check:', {
        hasDataObject: Boolean(data.data),
        patientObject: data.data?.patient,
        patientId: data.data?.patient_id || data.data?.patient?.id,
        assignmentId: data.assignment_id
      });
      
      // Accept messages even without patient name if we have an ID
      // Let's be more lenient about the structure
      const hasPatientInfo = 
        (data.data?.patient_id) || 
        (data.data?.patient?.id) || 
        (data.assignment_id); // Use assignment ID as fallback
        
      if (!hasPatientInfo) {
        console.log('Notification lacks patient identifier:', data);
        // Create a simple notification anyway to make sure it shows up
        const newNotification = {
          id: data.message_id || `notif-${Date.now()}`,
          title: 'New Patient Assignment',
          message: 'A new patient has been assigned to you.',
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
        
        // Show toast notification
        toast.info('New patient assigned', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
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
      const patientId = data.data.patient_id || patientData.id || data.assignment_id;
      
      // Extract name if available
      let firstName = '';
      let lastName = '';
      
      if (patientData.name) {
        const nameParts = patientData.name.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      } else if (patientData.first_name || patientData.last_name) {
        firstName = patientData.first_name || '';
        lastName = patientData.last_name || '';
      }
      
      // Create a patient object with available info
      const patient = {
        id: patientId,
        first_name: firstName,
        last_name: lastName,
        registration_number: patientData.registration_number,
        date_of_birth: patientData.date_of_birth || 
                       (patientData.age ? new Date(new Date().setFullYear(new Date().getFullYear() - patientData.age)).toISOString() : null),
        gender: patientData.gender,
        phone_number: patientData.phone_number,
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
      <div className="relative">
        <motion.div
          animate={bellAnimation}
          className="relative"
        >
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors duration-200 relative"
            aria-label="Show notifications"
          >
            <FiBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center shadow-md">
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
              transition={{ duration: 0.2 }}
              className="fixed right-0 top-0 mt-20 mr-8 w-80 md:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
              style={{ zIndex: 9999 }}
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-medium text-slate-800 dark:text-white">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    aria-label="Close notifications"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="py-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-200 ${
                          !notification.read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mr-3">
                            {notification.type === 'patient_assigned' ? (
                              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <FiUser className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <FiMessageSquare className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {notification.title}
                              </p>
                              <p className="ml-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {formatRelativeTime(notification.timestamp)}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                              {notification.message}
                            </p>
                            
                            {/* Patient preview if available */}
                            {notification.data?.patient && (
                              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600/50 text-xs">
                                <div className="flex items-center">
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mr-2">
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
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
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
                                  className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                                >
                                  View Patient
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                      <FiBell className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No notifications yet</p>
                  </div>
                )}
              </div>
              
              {/* Connection status */}
              <div className="p-2 border-t border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    connected ? 'bg-green-500' : 'bg-red-500'
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
                    className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors duration-200"
                  >
                    Reconnect
                  </button>
                )}
                
                {connecting && (
                  <span className="text-slate-500 dark:text-slate-400">Connecting...</span>
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
      <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="font-medium text-red-700 dark:text-red-300">Notification System Error</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">Please refresh the page to restore notifications.</p>
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
    <div className="mb-4">
      <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Recently Assigned</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recentPatients.map(patient => (
          <div 
            key={patient.id} 
            className="p-4 bg-white dark:bg-slate-700/70 rounded-xl border border-slate-200 dark:border-slate-700 shadow hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onViewPatientDetails(patient.id)}
          >
            <div className="flex items-start">
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mr-3">
                {getInitials(patient)}
              </div>
              <div>
                <h4 className="font-medium text-slate-800 dark:text-white">{getFullName(patient)}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {patient.registration_number || 'No Reg #'}
                </p>
                {patient.isNew && (
                  <span className="mt-1 inline-block px-1.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs rounded">
                    New
                  </span>
                )}
              </div>
            </div>
          </div>
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
  const [selectedFilter, setSelectedFilter] = useState('all');
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
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Handle new patient assignment from notification
  const handleNewPatientAssigned = (patient) => {
    // Only process patients with a valid id
    if (!patient || !patient.id) {
      console.log('Skipping patient without ID:', patient);
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
    return allPatients.filter(patient => patient.isNew || patient.assignedTimestamp || patient.created_at);
  }, [allPatients]);

  // Filter patients based on search term and selected filter - client-side filtering
  const filteredPatients = useMemo(() => {
    if (!allPatients.length) return [];
    
    return allPatients.filter(patient => {
      // Apply search filter
      const fullName = getFullName(patient).toLowerCase();
      const searchMatch = !searchTerm || 
        fullName.includes(searchTerm.toLowerCase()) || 
        (patient.email && patient.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (patient.phone_number && patient.phone_number.includes(searchTerm)) ||
        (patient.registration_number && patient.registration_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Apply status filter
      const hasCompleteProfile = Boolean(patient.first_name || patient.last_name || patient.email || patient.phone_number);
      const statusMatch = selectedFilter === 'all' || 
        (selectedFilter === 'active' && hasCompleteProfile) || 
        (selectedFilter === 'inactive' && !hasCompleteProfile);
      
      return searchMatch && statusMatch;
    });
  }, [allPatients, searchTerm, selectedFilter]);

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
        setAllPatients(response.data.patients);
        setPatients(response.data.patients);
        setTotalPatients(response.data.patients.length);
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
      
      if (response.data && response.data.id) {
        setSelectedRecord(response.data);
        setShowViewRecordModal(true);
      } else {
        setRecordsError('Failed to load medical record');
      }
    } catch (err) {
      console.error('Error fetching medical record:', err);
      setRecordsError(`Error loading medical record: ${err.message}`);
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
      
      if (response.data && response.data.id) {
        setShowEditRecordModal(false);
        setOperationSuccess('Medical record updated successfully');
        
        // Update the records in the local state
        setPatientRecords(prevRecords => 
          prevRecords.map(record => 
            record.id === editRecordData.id ? response.data : record
          )
        );
        
        // Update selected record if it's being viewed
        if (selectedRecord && selectedRecord.id === editRecordData.id) {
          setSelectedRecord(response.data);
        }
      } else {
        setEditRecordError('Failed to update medical record');
      }
    } catch (err) {
      setEditRecordError(`Error updating medical record: ${err.message}`);
      console.error('Error updating medical record:', err);
    } finally {
      setUpdatingRecord(false);
    }
  };

  const openAddMedicalRecord = (patient) => {
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
      
      if (response.data && response.data.id) {
        // Reset form and close modal
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
        setShowNewRecordModal(false);
        setOperationSuccess('Medical record added successfully');
      } else {
        setFormError('Failed to create record');
      }
    } catch (err) {
      setFormError(`Error creating medical record: ${err.message}`);
      console.error('Error creating medical record:', err);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  // Error UI
  if (error && allPatients.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-teal-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 border border-slate-100 dark:border-slate-700 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
          <div className="flex items-center text-red-600 dark:text-red-400 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-4 flex-shrink-0">
              <FiAlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Connection Error</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">We couldn't connect to the server</p>
            </div>
          </div>
          <p className="text-slate-700 dark:text-slate-300 mb-6">{error}</p>
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => fetchAllPatients()}
            className="w-full py-3 px-6 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center font-medium"
          >
            <FiRefreshCw className="mr-2" /> Retry Connection
          </motion.button>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-blue-50/50 to-teal-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors duration-300">
      {/* Add a stylish background pattern */}
      <div className="absolute inset-0 bg-repeat opacity-5 pointer-events-none dark:opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>

      {/* Toast notifications container */}
      <ToastContainer 
        position="top-right" 
        theme={isDarkMode ? 'dark' : 'light'} 
        toastClassName="rounded-xl shadow-lg" 
      />
      
      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="space-y-8"
        >
          {/* Success notification */}
          <AnimatePresence>
            {operationSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-2xl shadow-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center backdrop-blur-sm"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center mr-4 flex-shrink-0">
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
            className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl border border-slate-100/50 dark:border-slate-700/50 transition-all duration-200 overflow-hidden"
          >
            {/* Hero section with header and intro */}
            <div className="relative overflow-hidden">
              {/* Animated Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-teal-500/10 dark:from-indigo-900/20 dark:via-purple-900/20 dark:to-teal-900/20 animate-gradient-shift"></div>
              
              {/* Network-like Abstract Pattern */}
              <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.12] pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="network-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                      <path d="M0 50 L100 50 M50 0 L50 100 M25 25 L75 75 M75 25 L25 75" stroke="currentColor" strokeWidth="1" fill="none" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width="100%" height="100%" fill="url(#network-pattern)" />
                </svg>
              </div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-8 relative z-10">
                <div className="mb-6 md:mb-0">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-teal-400 mb-2">My Patients</h1>
                  <p className="text-slate-600 dark:text-slate-400 max-w-xl">Manage your patient records, medical history, and treatment plans in one secure platform.</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Notification center with callbacks */}
                  <NotificationCenter 
                    doctor_id={user?.id} 
                    onNewPatientAssigned={handleNewPatientAssigned}
                    onViewPatientDetails={handleViewPatientDetails}
                  />
                  
                  <div className="hidden md:block text-right">
                    <span className="text-sm text-slate-500 dark:text-slate-400 block">Welcome back,</span>
                    <span className="text-base font-semibold text-slate-800 dark:text-white">Dr. {user?.name || 'Doctor'}</span>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-lg shadow-lg">
                    {user?.name?.charAt(0) || 'D'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Recent Patients Cards Section */}
            {recentlyAssignedPatients.length > 0 && (
              <div className="px-6 md:px-8 mb-6">
                <RecentPatientCards 
                  patients={recentlyAssignedPatients} 
                  onViewPatientDetails={handleViewPatientDetails}
                  getInitials={getInitials}
                  getFullName={getFullName}
                />
              </div>
            )}
            
            {/* Search & Filters Section */}
            <div className="px-6 md:px-8">
              <motion.div 
                className="flex flex-col xl:flex-row items-stretch justify-between mb-6 space-y-4 xl:space-y-0 xl:space-x-4"
                variants={fadeInUp}
              >
                <div className="flex-grow flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FiSearch className="text-indigo-400 dark:text-indigo-300" />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Search by name, email, or phone..." 
                      className="pl-11 pr-4 py-3.5 w-full border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-700/70 backdrop-blur-sm transition-all duration-200 shadow-sm placeholder-slate-400 dark:placeholder-slate-500 text-base"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <FiFilter className="text-indigo-400 dark:text-indigo-300" />
                    </div>
                    <select 
                      className="pl-11 pr-10 py-3.5 bg-white/80 dark:bg-slate-700/70 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all duration-200 shadow-sm text-base appearance-none"
                      value={selectedFilter}
                      onChange={(e) => setSelectedFilter(e.target.value)}
                    >
                      <option value="all">All Patients</option>
                      <option value="active">Active Patients</option>
                      <option value="inactive">Incomplete Profiles</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <motion.button 
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="py-3.5 px-5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/70 transition-all duration-200 shadow-sm flex items-center backdrop-blur-sm bg-white/80 dark:bg-slate-700/50"
                  >
                    <FiSliders className="mr-2 text-indigo-500 dark:text-indigo-400" />
                    <span>Advanced Filters</span>
                  </motion.button>
                </div>
              </motion.div>
            </div>
            
            {/* Patients Table Section */}
            <div className="px-6 md:px-8 pb-8">
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 transition-all duration-200 bg-white dark:bg-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Name
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
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {paginatedPatients.length > 0 ? (
                        paginatedPatients.map((patient, idx) => {
                          const fullName = getFullName(patient);
                          const hasCompleteProfile = Boolean(patient.first_name || patient.last_name || patient.email || patient.phone_number);
                          
                          return (
                            <motion.tr 
                              key={patient.id} 
                              className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150 ${
                                patient.isNew ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''
                              }`}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: idx * 0.05 }}
                              whileHover={{ backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 relative">
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse-slow"></div>
                                    <div className="absolute inset-[2px] rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                                      <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                        {getInitials(patient)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="flex items-center">
                                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{fullName}</div>
                                      {patient.isNew && (
                                        <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs rounded font-medium">
                                          NEW
                                        </span>
                                      )}
                                    </div>
                                    {patient.registration_number && (
                                      <div className="text-xs text-slate-500 dark:text-slate-400">#{patient.registration_number}</div>
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
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{patient.phone_number || 'No Phone'}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{patient.email || 'No Email'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1.5 inline-flex text-xs font-medium rounded-full ${
                                  hasCompleteProfile 
                                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50' 
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                                }`}>
                                  {hasCompleteProfile ? 'Active' : 'Incomplete'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end space-x-1">
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-150" 
                                    title="View patient details"
                                    onClick={() => viewPatientDetails(patient.id)}
                                    aria-label="View patient details"
                                  >
                                    <FiEye className="w-5 h-5" />
                                  </motion.button>
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-150" 
                                    title="View medical records"
                                    onClick={() => fetchPatientRecords(patient.id)}
                                    aria-label="View medical records"
                                  >
                                    <FiList className="w-5 h-5" />
                                  </motion.button>
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300 rounded-full hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all duration-150" 
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
                                <div className="w-12 h-12 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin mb-4"></div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Loading patients...</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                                  <FiUser className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No patients found</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto text-center">
                                  Try adjusting your search criteria or filters to find the patients you're looking for.
                                </p>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="px-4 py-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors duration-150 flex items-center"
                                  onClick={() => {
                                    setSearchTerm('');
                                    setSelectedFilter('all');
                                  }}
                                >
                                  <FiRefreshCw className="mr-2" />
                                  Reset filters
                                </motion.button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="bg-slate-50 dark:bg-slate-700/30 px-6 py-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{paginatedPatients.length}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPatients}</span> patients
                  </p>
                  {totalPatients > patientsPerPage && (
                    <div className="flex items-center space-x-1">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`p-2 rounded-lg border ${
                          currentPage === 1 
                            ? 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-500 dark:hover:text-indigo-400'
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
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`p-2 w-10 h-10 flex items-center justify-center rounded-lg ${
                              currentPage === pageNum 
                                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border border-indigo-500' 
                                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
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
                            ? 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-500 dark:hover:text-indigo-400'
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
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Patient Details</h2>
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Loading state */}
                  {loadingDetails ? (
                    <div className="p-8 flex flex-col items-center justify-center">
                      <div className="w-14 h-14 border-t-3 border-b-3 border-indigo-500 rounded-full animate-spin mb-4"></div>
                      <p className="text-slate-600 dark:text-slate-400">Loading patient details...</p>
                    </div>
                  ) : detailsError ? (
                    <div className="p-6 text-center">
                      <div className="w-16 h-16 mx-auto flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full mb-4">
                        <FiAlertCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Error Loading Details</h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-4">{detailsError}</p>
                      <button
                        onClick={() => setShowDetailsModal(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Patient info */}
                      <div className="p-6">
                        <div className="flex flex-col md:flex-row md:items-start mb-6">
                          {/* Patient avatar and basic info */}
                          <div className="flex items-center md:items-start mb-6 md:mb-0 md:mr-6">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold shadow-lg relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse-slow"></div>
                              <div className="absolute inset-[2px] rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                                <span className="text-2xl font-medium text-indigo-700 dark:text-indigo-300 relative">
                                  {getInitials(selectedPatient)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-6">
                              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{getFullName(selectedPatient)}</h3>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {selectedPatient.gender && (
                                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs">
                                    {selectedPatient.gender}
                                  </span>
                                )}
                                {selectedPatient.date_of_birth && (
                                  <span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 rounded text-xs">
                                    {calculateAge(selectedPatient.date_of_birth)} years
                                  </span>
                                )}
                                {selectedPatient.registration_number && (
                                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs">
                                    #{selectedPatient.registration_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Contact Information</h4>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                                <p className="text-slate-900 dark:text-white font-medium">{selectedPatient.email || 'Not provided'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Phone</p>
                                <p className="text-slate-900 dark:text-white font-medium">{selectedPatient.phone_number || 'Not provided'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Address</p>
                                <p className="text-slate-900 dark:text-white font-medium">{selectedPatient.address || 'Not provided'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Emergency Contact</p>
                                <p className="text-slate-900 dark:text-white font-medium">
                                  {selectedPatient.emergency_contact_name ? 
                                    `${selectedPatient.emergency_contact_name} (${selectedPatient.emergency_contact_phone || 'No phone'})` : 
                                    'Not provided'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                            <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">Medical Information</h4>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Blood Group</p>
                                <p className="text-slate-900 dark:text-white font-medium">{selectedPatient.blood_group || 'Not recorded'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Allergies</p>
                                <div className="text-slate-900 dark:text-white font-medium">
                                  {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {selectedPatient.allergies.map((allergy, index) => (
                                        <span key={index} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs">
                                          {allergy}
                                        </span>
                                      ))}
                                    </div>
                                  ) : 'None recorded'}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Registered Since</p>
                                <p className="text-slate-900 dark:text-white font-medium">{selectedPatient.created_at ? formatDate(selectedPatient.created_at) : 'Not available'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => {
                              setShowDetailsModal(false);
                              fetchPatientRecords(selectedPatient.id);
                            }}
                            className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex items-center"
                          >
                            <FiList className="mr-2" /> View Medical Records
                          </button>
                          <button
                            onClick={() => {
                              setShowDetailsModal(false);
                              openAddMedicalRecord(selectedPatient);
                            }}
                            className="px-4 py-2 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors flex items-center"
                          >
                            <FiFileText className="mr-2" /> Add Medical Record
                          </button>
                          <button
                            onClick={() => setShowDetailsModal(false)}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          >
                            Close
                          </button>
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
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Medical Records</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{getFullName(selectedPatient)}</p>
                    </div>
                    <button
                      onClick={() => setShowMedicalRecordsModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {/* Loading state */}
                    {loadingRecords ? (
                      <div className="py-10 flex flex-col items-center justify-center">
                        <div className="w-14 h-14 border-t-3 border-b-3 border-indigo-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-slate-600 dark:text-slate-400">Loading medical records...</p>
                      </div>
                    ) : recordsError ? (
                      <div className="py-8 text-center">
                        <div className="w-16 h-16 mx-auto flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full mb-4">
                          <FiAlertCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Error Loading Records</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">{recordsError}</p>
                        <button
                          onClick={() => setShowMedicalRecordsModal(false)}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* No records state */}
                        {patientRecords.length === 0 ? (
                          <div className="py-10 text-center">
                            <div className="w-16 h-16 mx-auto flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-full mb-4">
                              <FiFileText className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Medical Records</h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                              This patient doesn't have any medical records yet. You can create the first record.
                            </p>
                            <div className="flex justify-center">
                              <button
                                onClick={() => {
                                  setShowMedicalRecordsModal(false);
                                  openAddMedicalRecord(selectedPatient);
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg transition-colors shadow-sm flex items-center"
                              >
                                <FiPlus className="mr-2" /> Add Medical Record
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Records list */}
                            <div className="mb-6 flex justify-between items-center">
                              <h3 className="text-lg font-medium text-slate-800 dark:text-white">
                                {patientRecords.length} Record{patientRecords.length !== 1 && 's'}
                              </h3>
                              <button
                                onClick={() => {
                                  setShowMedicalRecordsModal(false);
                                  openAddMedicalRecord(selectedPatient);
                                }}
                                className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex items-center text-sm"
                              >
                                <FiPlus className="mr-1" /> Add Record
                              </button>
                            </div>
                            
                            <div className="space-y-4 overflow-y-auto max-h-96">
                              {patientRecords.map((record) => (
                                <div
                                  key={record.id}
                                  className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:shadow-md transition-shadow"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <h4 className="font-medium text-slate-900 dark:text-white">{record.diagnosis}</h4>
                                      <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {new Date(record.created_at).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => viewMedicalRecord(selectedPatient.id, record.id)}
                                        className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                        title="View record details"
                                      >
                                        <FiEye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => openEditRecord(record)}
                                        className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                        title="Edit record"
                                      >
                                        <FiEdit className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    {record.treatment && (
                                      <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                                        <span className="font-medium">Treatment:</span> {record.treatment.substring(0, 100)}
                                        {record.treatment.length > 100 && '...'}
                                      </p>
                                    )}
                                    {record.medications && record.medications.length > 0 && (
                                      <div className="mt-2">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Medications:</span>
                                        <div className="flex flex-wrap gap-1">
                                          {record.medications.slice(0, 3).map((med, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 rounded-full text-xs"
                                            >
                                              {med}
                                            </span>
                                          ))}
                                          {record.medications.length > 3 && (
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-full text-xs">
                                              +{record.medications.length - 3} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        {/* Footer */}
                        <div className="flex justify-end mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => setShowMedicalRecordsModal(false)}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                          >
                            Close
                          </button>
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
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Medical Record</h2>
                    <button
                      onClick={() => setShowViewRecordModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="mb-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">{selectedRecord.diagnosis}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                            <FiCalendar className="w-4 h-4 mr-1" /> 
                            {new Date(selectedRecord.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Diagnosis & Treatment */}
                      <div className="space-y-4 mb-6">
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">Diagnosis</h4>
                          <p className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {selectedRecord.diagnosis}
                          </p>
                        </div>
                        
                        {selectedRecord.treatment && (
                          <div>
                            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">Treatment</h4>
                            <p className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                              {selectedRecord.treatment}
                            </p>
                          </div>
                        )}
                        
                        {selectedRecord.notes && (
                          <div>
                            <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">Notes</h4>
                            <p className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                              {selectedRecord.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Medications */}
                      {selectedRecord.medications && selectedRecord.medications.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">Medications</h4>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                            <ul className="space-y-1">
                              {selectedRecord.medications.map((med, idx) => (
                                <li 
                                  key={idx}
                                  className="flex items-center text-slate-800 dark:text-slate-200"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-2 flex-shrink-0"></span>
                                  {med}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Vital Signs */}
                      {selectedRecord.vital_signs && Object.values(selectedRecord.vital_signs).some(v => v) && (
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">Vital Signs</h4>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg grid grid-cols-2 gap-4">
                            {selectedRecord.vital_signs.temperature && (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Temperature</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {selectedRecord.vital_signs.temperature} °C
                                </p>
                              </div>
                            )}
                            {selectedRecord.vital_signs.blood_pressure && (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Blood Pressure</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {selectedRecord.vital_signs.blood_pressure} mmHg
                                </p>
                              </div>
                            )}
                            {selectedRecord.vital_signs.heart_rate && (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Heart Rate</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {selectedRecord.vital_signs.heart_rate} bpm
                                </p>
                              </div>
                            )}
                            {selectedRecord.vital_signs.respiratory_rate && (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Respiratory Rate</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {selectedRecord.vital_signs.respiratory_rate} breaths/min
                                </p>
                              </div>
                            )}
                            {selectedRecord.vital_signs.oxygen_saturation && (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Oxygen Saturation</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                  {selectedRecord.vital_signs.oxygen_saturation}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Follow Up Date */}
                      {selectedRecord.follow_up_date && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">Follow-up Date</h4>
                          <p className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-slate-800 dark:text-slate-200 flex items-center">
                            <FiCalendar className="mr-2 text-indigo-500 dark:text-indigo-400" />
                            {new Date(selectedRecord.follow_up_date).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => {
                          setShowViewRecordModal(false);
                          openEditRecord(selectedRecord);
                        }}
                        className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex items-center"
                      >
                        <FiEdit className="mr-2" /> Edit Record
                      </button>
                      <button
                        onClick={() => setShowViewRecordModal(false)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Edit Medical Record Modal */}
          <AnimatePresence>
            {showEditRecordModal && editRecordData && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Edit Medical Record</h2>
                    <button
                      onClick={() => setShowEditRecordModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {editRecordError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                        {editRecordError}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Diagnosis Field */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">
                          Diagnosis <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="diagnosis"
                          value={editRecordData.diagnosis || ''}
                          onChange={handleEditRecordChange}
                          className={`w-full p-3 border ${
                            editFormTouched.diagnosis && !editRecordData.diagnosis
                              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                          } rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent`}
                          rows="3"
                          placeholder="Enter patient diagnosis"
                        ></textarea>
                        {editFormTouched.diagnosis && !editRecordData.diagnosis && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">Diagnosis is required</p>
                        )}
                      </div>
                      
                      {/* Treatment Field */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Treatment</label>
                        <textarea
                          name="treatment"
                          value={editRecordData.treatment || ''}
                          onChange={handleEditRecordChange}
                          className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                          rows="3"
                          placeholder="Enter treatment details"
                        ></textarea>
                      </div>
                      
                      {/* Notes Field */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Notes</label>
                        <textarea
                          name="notes"
                          value={editRecordData.notes || ''}
                          onChange={handleEditRecordChange}
                          className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                          rows="3"
                          placeholder="Enter additional notes"
                        ></textarea>
                      </div>
                      
                      {/* Medications */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Medications</label>
                        <div className="flex mb-2">
                          <input
                            type="text"
                            value={medicationInput}
                            onChange={(e) => setMedicationInput(e.target.value)}
                            className="flex-grow p-3 border border-slate-300 dark:border-slate-600 rounded-l-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                            placeholder="Enter medication"
                          />
                          <button
                            type="button"
                            onClick={addEditMedication}
                            className="px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-r-lg flex items-center"
                          >
                            <FiPlus />
                          </button>
                        </div>
                        
                        {/* Medications List */}
                        {editRecordData.medications && editRecordData.medications.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                            <ul className="space-y-1">
                              {editRecordData.medications.map((med, idx) => (
                                <li key={idx} className="flex justify-between items-center">
                                  <span className="text-slate-800 dark:text-slate-200 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-2 flex-shrink-0"></span>
                                    {med}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeEditMedication(idx)}
                                    className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <FiMinus className="w-4 h-4" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* Vital Signs */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Vital Signs</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Temperature (°C)</label>
                            <input
                              type="text"
                              name="vital_signs.temperature"
                              value={editRecordData.vital_signs?.temperature || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter temperature"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Blood Pressure (mmHg)</label>
                            <input
                              type="text"
                              name="vital_signs.blood_pressure"
                              value={editRecordData.vital_signs?.blood_pressure || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="e.g. 120/80"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Heart Rate (bpm)</label>
                            <input
                              type="text"
                              name="vital_signs.heart_rate"
                              value={editRecordData.vital_signs?.heart_rate || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter heart rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Respiratory Rate (breaths/min)</label>
                            <input
                              type="text"
                              name="vital_signs.respiratory_rate"
                              value={editRecordData.vital_signs?.respiratory_rate || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter respiratory rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Oxygen Saturation (%)</label>
                            <input
                              type="text"
                              name="vital_signs.oxygen_saturation"
                              value={editRecordData.vital_signs?.oxygen_saturation || ''}
                              onChange={handleEditRecordChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter oxygen saturation"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Follow-up Date */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Follow-up Date</label>
                        <input
                          type="date"
                          name="follow_up_date"
                          value={editRecordData.follow_up_date || ''}
                          onChange={handleEditRecordChange}
                          className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                        />
                      </div>
                      
                      {/* JSON Data Input for advanced users */}
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <details className="text-sm">
                          <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium">
                            Advanced: Edit as JSON
                          </summary>
                          <div className="mt-2">
                            <textarea
                              className="w-full h-48 p-3 font-mono text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Paste JSON data"
                              onChange={(e) => handleJSONDataInput(e, true)}
                              defaultValue={JSON.stringify(editRecordData, null, 2)}
                            ></textarea>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              You can paste a JSON object with the fields you want to update. 
                              This is for advanced users only.
                            </p>
                          </div>
                        </details>
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setShowEditRecordModal(false)}
                        disabled={updatingRecord}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={updateMedicalRecord}
                        disabled={updatingRecord}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center"
                      >
                        {updatingRecord ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          <>
                            <FiSave className="mr-2" /> Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          {/* Add Medical Record Modal */}
          <AnimatePresence>
            {showNewRecordModal && selectedPatient && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Add Medical Record</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Patient: {getFullName(selectedPatient)}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowNewRecordModal(false)}
                      className="p-1 rounded-full bg-white/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto max-h-[80vh]">
                    {formError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                        {formError}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Diagnosis Field */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">
                          Diagnosis <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="diagnosis"
                          value={newRecord.diagnosis}
                          onChange={handleInputChange}
                          className={`w-full p-3 border ${
                            formTouched.diagnosis && !newRecord.diagnosis
                              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                          } rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white`}
                          rows="3"
                          placeholder="Enter patient diagnosis"
                        ></textarea>
                        {formTouched.diagnosis && !newRecord.diagnosis && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">Diagnosis is required</p>
                        )}
                      </div>
                      
                      {/* Treatment Field */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Treatment</label>
                        <textarea
                          name="treatment"
                          value={newRecord.treatment}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                          rows="3"
                          placeholder="Enter treatment details"
                        ></textarea>
                      </div>
                      
                      {/* Notes Field */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Notes</label>
                        <textarea
                          name="notes"
                          value={newRecord.notes}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                          rows="3"
                          placeholder="Enter additional notes"
                        ></textarea>
                      </div>
                      
                      {/* Medications */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Medications</label>
                        <div className="flex mb-2">
                          <input
                            type="text"
                            value={medicationInput}
                            onChange={(e) => setMedicationInput(e.target.value)}
                            className="flex-grow p-3 border border-slate-300 dark:border-slate-600 rounded-l-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                            placeholder="Enter medication"
                          />
                          <button
                            type="button"
                            onClick={addMedication}
                            className="px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-r-lg flex items-center"
                          >
                            <FiPlus />
                          </button>
                        </div>
                        
                        {/* Medications List */}
                        {newRecord.medications.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                            <ul className="space-y-1">
                              {newRecord.medications.map((med, idx) => (
                                <li key={idx} className="flex justify-between items-center">
                                  <span className="text-slate-800 dark:text-slate-200 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-2 flex-shrink-0"></span>
                                    {med}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeMedication(idx)}
                                    className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <FiMinus className="w-4 h-4" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* Vital Signs */}
                      <div>
                        <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Vital Signs</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Temperature (°C)</label>
                            <input
                              type="text"
                              name="vital_signs.temperature"
                              value={newRecord.vital_signs.temperature}
                              onChange={handleInputChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter temperature"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Blood Pressure (mmHg)</label>
                            <input
                              type="text"
                              name="vital_signs.blood_pressure"
                              value={newRecord.vital_signs.blood_pressure}
                              onChange={handleInputChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="e.g. 120/80"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Heart Rate (bpm)</label>
                            <input
                              type="text"
                              name="vital_signs.heart_rate"
                              value={newRecord.vital_signs.heart_rate}
                              onChange={handleInputChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter heart rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Respiratory Rate (breaths/min)</label>
                            <input
                              type="text"
                              name="vital_signs.respiratory_rate"
                              value={newRecord.vital_signs.respiratory_rate}
                              onChange={handleInputChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter respiratory rate"
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-sm text-slate-600 dark:text-slate-400">Oxygen Saturation (%)</label>
                            <input
                              type="text"
                              name="vital_signs.oxygen_saturation"
                              value={newRecord.vital_signs.oxygen_saturation}
                              onChange={handleInputChange}
                              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Enter oxygen saturation"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Follow-up Date */}
                      <div>
                        <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">Follow-up Date</label>
                        <input
                          type="date"
                          name="follow_up_date"
                          value={newRecord.follow_up_date}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                        />
                      </div>
                      
                      {/* JSON Data Input for advanced users */}
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <details className="text-sm">
                          <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium">
                            Advanced: Edit as JSON
                          </summary>
                          <div className="mt-2">
                            <textarea
                              className="w-full h-48 p-3 font-mono text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent text-slate-900 dark:text-white"
                              placeholder="Paste JSON data"
                              onChange={handleJSONDataInput}
                              defaultValue={JSON.stringify(newRecord, null, 2)}
                            ></textarea>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              You can paste a JSON object with medical record data.
                              This is for advanced users only.
                            </p>
                          </div>
                        </details>
                      </div>
                    </div>
                    
                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setShowNewRecordModal(false)}
                        disabled={submitting}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => createMedicalRecord(selectedPatient.id)}
                        disabled={submitting}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center"
                      >
                        {submitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <FiSave className="mr-2" /> Save Record
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      
      {/* Add custom CSS animations */}
      <style jsx>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animate-gradient-shift {
          background-size: 200% 200%;
          animation: gradient-shift 8s ease infinite;
        }
        
        .animate-gradient-slow {
          background-size: 200% 200%;
          animation: gradient-shift 6s ease infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .animation-delay-150 {
          animation-delay: 150ms;
        }
        
        .border-t-3 {
          border-top-width: 3px;
        }
        
        .border-b-3 {
          border-bottom-width: 3px;
        }
        
        .border-r-3 {
          border-right-width: 3px;
        }
        
        .border-l-3 {
          border-left-width: 3px;
        }
      `}</style>
    </div>
  );
};

export default PatientManagement;
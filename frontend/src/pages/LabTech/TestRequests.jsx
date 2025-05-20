import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  FiSearch, FiCheckCircle, FiClock, FiAlertCircle, FiFileText, 
  FiUserPlus, FiFilter, FiCalendar, FiX, 
  FiBell, FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight, 
  FiSettings, FiDownload, FiActivity, FiEdit, FiTrash2, FiSave,
  FiInfo, FiPlay
} from 'react-icons/fi';
import { MdOutlineBiotech, MdPriorityHigh } from 'react-icons/md';
import axios from 'axios';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Create a new audio element instead of using AudioContext
const notificationSound = new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg');
notificationSound.volume = 0.1; // Set volume to 10%

// Function to play notification sound
const playNotificationSound = () => {
  try {
    // Reset the audio to start (in case it was playing)
    notificationSound.currentTime = 0;
    // Play the sound
    const playPromise = notificationSound.play();
    
    // Handle play() promise to avoid uncaught promise errors
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.error("Error playing notification sound:", error);
      });
    }
    console.log("Notification sound played successfully");
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
};

// Standalone WebSocket Manager singleton (outside React lifecycle)
// This prevents connection problems during React StrictMode double-mounting
const WebSocketManager = (() => {
  let socket = null;
  let instances = 0;
  let connecting = false;
  let lastStatus = 'disconnected';
  let reconnectTimeout = null;
  let pingInterval = null;
  let connectionTimeout = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const listeners = new Set();
  const messagesReceived = { count: 0 };
  let lastMessage = null;
  let multipleSocketConnections = {}; // Store multiple socket connections
  
  // Notify all listeners of state changes
  const notifyListeners = (event, data) => {
    listeners.forEach(listener => {
      if (typeof listener === 'function') {
        listener(event, data);
      }
    });
  };
  
  // Create WebSocket connection
  const connect = (technicianId, additionalIds = []) => {
    if (!technicianId || connecting) return;
    
    // Create a set of IDs to connect to
    const allIds = [technicianId, ...additionalIds].filter(Boolean);
    
    console.log(`[WebSocketManager] Creating connections for IDs:`, allIds);
    connecting = true;
    lastStatus = 'connecting';
    notifyListeners('status', lastStatus);
    
    // Clear any existing timeouts and intervals
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    
    // Clean up existing connections
    for (const id in multipleSocketConnections) {
      try {
        const s = multipleSocketConnections[id];
        s.onopen = null;
        s.onclose = null;
        s.onerror = null;
        s.onmessage = null;
        
        if (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING) {
          s.close();
        }
      } catch (err) {
        console.error(`[WebSocketManager] Error cleaning up socket for ${id}:`, err);
      }
    }
    
    multipleSocketConnections = {};
    socket = null;
    
    // Create connections for each ID
    for (const id of allIds) {
      createSingleConnection(id);
    }
    
    // Set up ping interval to keep connection alive
    pingInterval = setInterval(() => {
      for (const id in multipleSocketConnections) {
        const s = multipleSocketConnections[id];
        if (s && s.readyState === WebSocket.OPEN) {
          try {
            console.log(`[WebSocketManager] Sending ping to connection ${id}`);
            s.send(JSON.stringify({ type: "ping" }));
          } catch (err) {
            console.error(`[WebSocketManager] Error sending ping to ${id}:`, err);
          }
        }
      }
    }, 15000);
    
    connecting = false;
    
    // If we have a primary connection, use it as the main socket
    if (multipleSocketConnections[technicianId] && multipleSocketConnections[technicianId].readyState === WebSocket.OPEN) {
      socket = multipleSocketConnections[technicianId];
      lastStatus = 'connected';
      notifyListeners('status', lastStatus);
    }
  };
  
  const createSingleConnection = (id) => {
    try {
      // Use the backend-provided WebSocket endpoint format with the proper path
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname === 'localhost' ? `${window.location.hostname}:8025` : window.location.host;
      // Important: Use the exact backend endpoint pattern from the comment
      const wsUrl = `${wsProtocol}//${wsHost}/ws/lab-requests/${id}`;
      
      console.log(`[WebSocketManager] Connecting to: ${wsUrl}`);
      
      const newSocket = new WebSocket(wsUrl);
      multipleSocketConnections[id] = newSocket;
      
      // Set connection timeout for this connection
      const thisConnectionTimeout = setTimeout(() => {
        if (newSocket && newSocket.readyState !== WebSocket.OPEN) {
          console.warn(`[WebSocketManager] Connection timeout for ID ${id} - socket failed to open`);
          
          try {
            newSocket.close();
          } catch (e) {}
          
          delete multipleSocketConnections[id];
          
          // If this was the primary connection
          if (id === [...listeners][0]?.technicianId) {
            lastStatus = 'timeout';
            notifyListeners('status', lastStatus);
            
            // Try to reconnect
            handleReconnect();
          }
        }
      }, 8000);
      
      newSocket.onopen = () => {
        console.log(`[WebSocketManager] Connection established successfully for ID ${id}`);
        
        // Clear connection timeout
        clearTimeout(thisConnectionTimeout);
        
        // If this is the main connection
        if (id === [...listeners][0]?.technicianId) {
          socket = newSocket;
          lastStatus = 'connected';
          reconnectAttempts = 0;
          notifyListeners('status', lastStatus);
        }
      };
      
      // In your WebSocketManager, add this at the very beginning of the onmessage handler:
      newSocket.onmessage = (event) => {
        // Log raw message before any processing
        console.log(`[RAW WebSocket Message from ${id}]:`, event.data);
        
        try {
          // Try to parse as JSON
          const rawData = JSON.parse(event.data);
          console.log(`[Parsed WebSocket Data from ${id}]:`, rawData);
        } catch (e) {
          // Not JSON data
          console.log(`[Non-JSON WebSocket Data from ${id}]`);
        }
        
        // Continue with normal processing
        processMessage(event, id);
      };
      
      newSocket.onclose = (event) => {
        console.log(`[WebSocketManager] Connection closed for ID ${id}: ${event.code}, ${event.reason || 'No reason provided'}`);
        
        delete multipleSocketConnections[id];
        
        // If this was the main connection
        if (id === [...listeners][0]?.technicianId && Object.keys(multipleSocketConnections).length === 0) {
          lastStatus = 'disconnected';
          notifyListeners('status', lastStatus);
          
          // Try to reconnect if not manually closed
          if (instances > 0 && event.code !== 1000) {
            handleReconnect();
          }
        }
      };
      
      newSocket.onerror = (error) => {
        console.error(`[WebSocketManager] Socket error for ID ${id}:`, error);
        
        // If this was the main connection
        if (id === [...listeners][0]?.technicianId) {
          lastStatus = 'error';
          notifyListeners('status', lastStatus);
        }
      };
    } catch (err) {
      console.error(`[WebSocketManager] Error creating WebSocket for ${id}:`, err);
      
      // If this was the main connection
      if (id === [...listeners][0]?.technicianId) {
        lastStatus = 'error';
        notifyListeners('status', lastStatus);
        
        // Try to reconnect
        handleReconnect();
      }
    }
  };
  
  const processMessage = (event, connectionId) => {
    messagesReceived.count++;
    lastMessage = event.data;
    
    try {
      console.log(`[WebSocketManager] Message received from ${connectionId}:`, event.data);
      
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (parseError) {
        console.error("[WebSocketManager] Error parsing message:", parseError);
        return;
      }
      
      // Enhanced logging of message structure for debugging
      console.log("[WebSocketManager] Message structure:", Object.keys(data));
      console.log("[WebSocketManager] Message content:", data);
      
      // Handle specific message types
      if (data.type === "connection_established") {
        console.log(`[WebSocketManager] Connection confirmed by server for ${connectionId}`);
      } else if (data.type === "pong") {
        console.log(`[WebSocketManager] Pong received from ${connectionId}`);
      } else if (data.type === "lab_request_received") {
        console.log(`[WebSocketManager] Lab request acknowledgment received from ${connectionId}:`, data);
      } else if (data.type === "new_lab_request") {
        // Extract the lab request data based on the backend's message format
        // This matches the format from the server logs
        const requestData = data.lab_request;
        console.log(`[WebSocketManager] New lab request notification from ${connectionId}:`, requestData);
        
        if (requestData) {
          notifyListeners('lab_request', requestData);
        }
      } else if (data.lab_request) {
        // Alternative format: direct lab_request field
        console.log(`[WebSocketManager] Lab request found in direct format from ${connectionId}:`, data.lab_request);
        notifyListeners('lab_request', data.lab_request);
      } else if (data.lab_request_id && data.type) {
        // Handle broadcast format where lab_request_id is at the top level
        console.log(`[WebSocketManager] Lab request broadcast format detected from ${connectionId}:`, data);
        
        // For this format, we should force a refresh of lab requests
        notifyListeners('refresh_needed', {
          requestId: data.lab_request_id,
          type: data.type
        });
      } else if (data.id) {
        // This might be a direct lab request without a specific type
        console.log(`[WebSocketManager] Potential lab request detected from ${connectionId}:`, data);
        notifyListeners('lab_request', data);
      } else {
        // Try to detect if any part of this message contains lab request data
        // Sometimes the data might be nested deeply in the message
        const extractPossibleRequest = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          
          // If object has test_type or patient_id, it might be a request
          if (obj.id && (obj.test_type || obj.patient_id)) {
            return obj;
          }
          
          // Check for lab_request field
          if (obj.lab_request && typeof obj.lab_request === 'object') {
            return obj.lab_request;
          }
          
          // Recursively search in nested objects
          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              const found = extractPossibleRequest(obj[key]);
              if (found) return found;
            }
          }
          
          return null;
        };
        
        const possibleRequest = extractPossibleRequest(data);
        if (possibleRequest) {
          console.log(`[WebSocketManager] Extracted possible lab request from complex message (${connectionId}):`, possibleRequest);
          notifyListeners('lab_request', possibleRequest);
        } else {
          // Pass all messages to listeners
          notifyListeners('message', data);
        }
      }
    } catch (error) {
      console.error(`[WebSocketManager] Error processing message from ${connectionId}:`, error);
    }
  };
  
  // Handle reconnection with exponential backoff
  const handleReconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("[WebSocketManager] Maximum reconnect attempts reached");
      lastStatus = 'failed';
      notifyListeners('status', lastStatus);
      return;
    }
    
    reconnectAttempts++;
    const delay = Math.min(30000, Math.pow(1.5, reconnectAttempts) * 1000);
    
    console.log(`[WebSocketManager] Scheduling reconnect in ${delay/1000}s (attempt ${reconnectAttempts})`);
    lastStatus = `reconnecting (${Math.round(delay/1000)}s)`;
    notifyListeners('status', lastStatus);
    
    reconnectTimeout = setTimeout(() => {
      console.log("[WebSocketManager] Executing reconnect");
      reconnectTimeout = null;
      
      // Get main technician ID and any additional IDs
      const techId = [...listeners].find(l => l.technicianId)?.technicianId;
      const additionalIds = [...listeners].filter(l => l.additionalIds).flatMap(l => l.additionalIds || []);
      
      if (techId) {
        connect(techId, additionalIds);
      } else {
        console.error("[WebSocketManager] Cannot reconnect: No technician ID available");
      }
    }, delay);
  };
  
  // Test notification with a mock lab request
  const simulateLabRequest = () => {
    const mockRequest = {
      id: "simulated-" + Math.random().toString(36).substring(2, 9),
      patient_id: "test-patient-id",
      doctor_id: "test-doctor-id",
      test_type: "blood_test",
      priority: "high",
      status: "pending",
      patient_name: "Test Patient",
      created_at: new Date().toISOString()
    };
    
    console.log("[WebSocketManager] Simulating lab request:", mockRequest);
    notifyListeners('lab_request', mockRequest);
    return mockRequest;
  };
  
  return {
    // Register a component instance and connect if needed
    register: (technicianId, listener, additionalIds = []) => {
      if (typeof listener === 'function') {
        // Store the technician ID with the listener for reconnect purposes
        listener.technicianId = technicianId;
        listener.additionalIds = additionalIds;
        listeners.add(listener);
      }
      
      instances++;
      console.log(`[WebSocketManager] Component registered, total: ${instances}`);
      
      // If this is the first instance, connect
      if (instances === 1 || 
          Object.keys(multipleSocketConnections).length === 0 || 
          !multipleSocketConnections[technicianId]) {
        // Delay initial connection to avoid React StrictMode double-mount issues
        setTimeout(() => {
          connect(technicianId, additionalIds);
        }, 300);
      } else {
        // Already connected - notify this listener of current status
        setTimeout(() => {
          listener('status', lastStatus);
        }, 0);
      }
    },
    
    // Unregister a component instance
    unregister: (listener) => {
      listeners.delete(listener);
      instances = Math.max(0, instances - 1);
      console.log(`[WebSocketManager] Component unregistered, remaining: ${instances}`);
      
      // If no instances left and we have a connection, close it
      if (instances === 0) {
        console.log("[WebSocketManager] No active components, cleaning up resources");
        
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        
        // Close all active connections
        for (const id in multipleSocketConnections) {
          try {
            const s = multipleSocketConnections[id];
            s.onclose = null; // Prevent reconnection attempts
            s.close();
          } catch (e) {}
        }
        
        multipleSocketConnections = {};
        socket = null;
      }
    },
    
    // Force a reconnection
    reconnect: (technicianId, additionalIds = []) => {
      // Close all connections
      for (const id in multipleSocketConnections) {
        try {
          const s = multipleSocketConnections[id];
          s.close();
        } catch (e) {}
      }
      
      multipleSocketConnections = {};
      socket = null;
      
      // Reset reconnect attempts for forced reconnects
      reconnectAttempts = 0;
      
      connect(technicianId, additionalIds);
    },
    
    // Get current status and stats
    getStatus: () => ({
      status: lastStatus,
      connected: Object.values(multipleSocketConnections).some(s => s.readyState === WebSocket.OPEN),
      messagesReceived: messagesReceived.count,
      reconnectAttempts,
      lastMessage,
      activeConnections: Object.keys(multipleSocketConnections).length
    }),
    
    // Send a message (if connected)
    sendMessage: (message) => {
      // Try to send on all active connections
      let sentOnAny = false;
      
      for (const id in multipleSocketConnections) {
        const s = multipleSocketConnections[id];
        if (s && s.readyState === WebSocket.OPEN) {
          try {
            s.send(typeof message === 'string' ? message : JSON.stringify(message));
            sentOnAny = true;
          } catch (err) {
            console.error(`[WebSocketManager] Error sending message to ${id}:`, err);
          }
        }
      }
      
      return sentOnAny;
    },
    
    // Simulate a lab request for testing
    simulateLabRequest
  };
})();

// React hook for using the WebSocket manager
const useLabRequestsWebSocket = (technician_id, onNewRequest) => {
  const [status, setStatus] = useState('disconnected');
  const [connected, setConnected] = useState(false);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastMessage, setLastMessage] = useState(null);
  const [activeConnections, setActiveConnections] = useState(0);
  
  // Default additional IDs to monitor based on logs
  // This is a key part of the fix - we're now connecting to both technician IDs
  const additionalIds = useMemo(() => [
    '722421d7-e863-46cd-9f55-35c992839c8a', // The doctor ID from the logs
    // Add any other IDs you notice in the logs
  ], []);
  
  // Event handler for WebSocket manager
  const handleWebSocketEvent = useCallback((event, data) => {
    if (event === 'status') {
      setStatus(data);
      setConnected(data === 'connected');
      
      // Update other stats
      const stats = WebSocketManager.getStatus();
      setMessagesReceived(stats.messagesReceived);
      setReconnectAttempts(stats.reconnectAttempts);
      setActiveConnections(stats.activeConnections);
      
    } else if (event === 'message') {
      // Process incoming messages
      setLastMessage(data);
      
      // Update message count
      const stats = WebSocketManager.getStatus();
      setMessagesReceived(stats.messagesReceived);
      
      // Process lab request messages
      if (data.type === "new_lab_request" && data.data) {
        console.log("New lab request received:", data.data);
        onNewRequest && onNewRequest(data.data);
      } else if (data.type === "new_lab_request" && data.lab_request) {
        console.log("New lab request received (format 2):", data.lab_request);
        onNewRequest && onNewRequest(data.lab_request);
      } else if (data.id && (data.patient_id || data.test_type)) {
        console.log("Potential lab request detected in message:", data);
        onNewRequest && onNewRequest(data);
      }
    } else if (event === 'lab_request') {
      // This is the new event type specifically for lab requests
      console.log("Lab request received in React hook:", data);
      
      // Normalize and ensure required fields are present
      const normalizedRequest = {
        ...data,
        // Convert properties to expected format based on logs
        id: data.id,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        test_type: data.test_type,
        priority: data.priority || data.urgency || 'medium',
        status: data.status || 'pending',
        patient_name: data.patient_name,
        requested_at: data.requested_at || data.created_at || new Date().toISOString()
      };
      
      console.log("Normalized lab request:", normalizedRequest);
      onNewRequest && onNewRequest(normalizedRequest);
    } else if (event === 'refresh_needed') {
      // Force refresh lab requests when we get a broadcast about a lab request update
      console.log("Refresh needed due to lab request update:", data);
      // This will be handled by the parent component's fetchLabRequests 
      onNewRequest && onNewRequest({
        id: data.requestId,
        refreshOnly: true,
        type: data.type
      });
    }
  }, [onNewRequest]);
  
  // Register with the WebSocket manager when the component mounts
  useEffect(() => {
    console.log("Registering with WebSocket manager:", technician_id, "with additional IDs:", additionalIds);
    
    // Update with initial status
    const initialStatus = WebSocketManager.getStatus();
    setStatus(initialStatus.status);
    setConnected(initialStatus.connected);
    setMessagesReceived(initialStatus.messagesReceived);
    setReconnectAttempts(initialStatus.reconnectAttempts);
    setLastMessage(initialStatus.lastMessage);
    setActiveConnections(initialStatus.activeConnections);
    
    // Register this component instance
    WebSocketManager.register(technician_id, handleWebSocketEvent, additionalIds);
    
    // Cleanup when component unmounts
    return () => {
      console.log("Unregistering from WebSocket manager");
      WebSocketManager.unregister(handleWebSocketEvent);
    };
  }, [technician_id, handleWebSocketEvent, additionalIds]);
  
  // Force reconnect method
  const forceReconnect = useCallback(() => {
    console.log("Forcing WebSocket reconnection");
    WebSocketManager.reconnect(technician_id, additionalIds);
  }, [technician_id, additionalIds]);
  
  // Test backend connectivity
  useEffect(() => {
    const testBackend = async () => {
      try {
        const response = await fetch('http://localhost:8025/health');
        const data = await response.json();
        console.log('Backend health check:', data);
      } catch (error) {
        console.error('Error reaching backend - server might be down:', error);
      }
    };
    
    testBackend();
  }, []);

  // Method to simulate receiving a lab request (for testing)
  const simulateLabRequest = useCallback(() => {
    return WebSocketManager.simulateLabRequest();
  }, []);
  
  return {
    connected,
    connectionStatus: status,
    messagesReceived,
    reconnectAttempts,
    lastMessage,
    activeConnections,
    connect: forceReconnect,
    simulateLabRequest
  };
};

const TEST_TYPES = {
  BLOOD: 'Blood Test',
  blood_test: 'Blood Test',
  URINE: 'Urine Test',
  urine_test: 'Urine Test',
  XRAY: 'X-Ray',
  xray: 'X-Ray',
  MRI: 'MRI Scan',
  mri_scan: 'MRI Scan',
  CT: 'CT Scan',
  ct_scan: 'CT Scan',
  ECG: 'ECG',
  ecg: 'ECG',
  ULTRASOUND: 'Ultrasound',
  ultrasound: 'Ultrasound',
  complete_blood_count: 'Complete Blood Count',
  comprehensive_metabolic_panel: 'Comprehensive Metabolic Panel',
  liver_function_test: 'Liver Function Test',
  thyroid_panel: 'Thyroid Panel'  // Added thyroid_panel as seen in logs
};

const TEST_PRIORITIES = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
  low: 'Routine',
  medium: 'Routine',
  high: 'Urgent',
  critical: 'Emergency'
};

// Priority colors
const PRIORITY_COLORS = {
  ROUTINE: {
    bg: 'bg-blue-500',
    text: 'text-white',
    gradient: 'from-blue-400 to-blue-600',
    shadow: 'shadow-blue-500/20'
  },
  URGENT: {
    bg: 'bg-orange-500',
    text: 'text-white',
    gradient: 'from-orange-400 to-orange-600',
    shadow: 'shadow-orange-500/20'
  },
  EMERGENCY: {
    bg: 'bg-red-500',
    text: 'text-white',
    gradient: 'from-red-500 to-red-600',
    shadow: 'shadow-red-500/20'
  },
  low: {
    bg: 'bg-blue-500',
    text: 'text-white',
    gradient: 'from-blue-400 to-blue-600',
    shadow: 'shadow-blue-500/20'
  },
  medium: {
    bg: 'bg-blue-500',
    text: 'text-white',
    gradient: 'from-blue-400 to-blue-600',
    shadow: 'shadow-blue-500/20'
  },
  high: {
    bg: 'bg-orange-500',
    text: 'text-white',
    gradient: 'from-orange-400 to-orange-600',
    shadow: 'shadow-orange-500/20'
  },
  critical: {
    bg: 'bg-red-500',
    text: 'text-white',
    gradient: 'from-red-500 to-red-600',
    shadow: 'shadow-red-500/20'
  }
};

const TEST_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  pending: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled'
};

// Status colors
const STATUS_COLORS = {
  PENDING: {
    bg: 'bg-yellow-500',
    text: 'text-white',
    gradient: 'from-yellow-400 to-amber-500',
    shadow: 'shadow-yellow-500/20',
    icon: <FiClock size={12} className="mr-1" />
  },
  pending: {
    bg: 'bg-yellow-500',
    text: 'text-white',
    gradient: 'from-yellow-400 to-amber-500',
    shadow: 'shadow-yellow-500/20',
    icon: <FiClock size={12} className="mr-1" />
  },
  IN_PROGRESS: {
    bg: 'bg-purple-500',
    text: 'text-white',
    gradient: 'from-purple-400 to-purple-600',
    shadow: 'shadow-purple-500/20',
    icon: <FiActivity size={12} className="mr-1" />
  },
  in_progress: {
    bg: 'bg-purple-500',
    text: 'text-white',
    gradient: 'from-purple-400 to-purple-600',
    shadow: 'shadow-purple-500/20',
    icon: <FiActivity size={12} className="mr-1" />
  },
  COMPLETED: {
    bg: 'bg-green-500',
    text: 'text-white',
    gradient: 'from-green-400 to-green-600',
    shadow: 'shadow-green-500/20',
    icon: <FiCheckCircle size={12} className="mr-1" />
  },
  completed: {
    bg: 'bg-green-500',
    text: 'text-white',
    gradient: 'from-green-400 to-green-600',
    shadow: 'shadow-green-500/20',
    icon: <FiCheckCircle size={12} className="mr-1" />
  },
  CANCELLED: {
    bg: 'bg-gray-500',
    text: 'text-white',
    gradient: 'from-gray-400 to-gray-600',
    shadow: 'shadow-gray-500/20',
    icon: <FiX size={12} className="mr-1" />
  },
  cancelled: {
    bg: 'bg-gray-500',
    text: 'text-white',
    gradient: 'from-gray-400 to-gray-600',
    shadow: 'shadow-gray-500/20',
    icon: <FiX size={12} className="mr-1" />
  }
};

// WebSocket Debug Component
const WebSocketDebug = ({ 
  status, 
  connected, 
  messagesReceived, 
  reconnectAttempts, 
  lastMessage, 
  activeConnections, 
  onReconnect,
  onSimulate 
}) => {
  const [showDebug, setShowDebug] = useState(false);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 border border-gray-200">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <FiInfo className="mr-2 text-blue-600" />
          WebSocket Connection
        </h3>
        <button 
          onClick={() => setShowDebug(!showDebug)} 
          className="px-3 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
          type="button"
        >
          {showDebug ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      <div className="flex items-center mt-2">
        <span className={`inline-block h-3 w-3 rounded-full mr-2 ${
          connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
        }`}></span>
        <span className="text-sm capitalize">
          {status.replace(/_/g, ' ')}
        </span>
        <span className="ml-2 text-xs text-gray-500">({messagesReceived} msgs received)</span>
        {activeConnections > 0 && (
          <span className="ml-2 text-xs text-green-500">
            ({activeConnections} active connections)
          </span>
        )}
        {reconnectAttempts > 0 && (
          <span className="ml-2 text-xs text-orange-500">
            ({reconnectAttempts} reconnect attempts)
          </span>
        )}
      </div>
      
      {showDebug && (
        <div className="mt-3 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Connection Status:</span>
            <span className={`font-medium ${connected ? 'text-green-600' : 'text-red-600'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Active Connections:</span>
            <span className="font-medium">{activeConnections}</span>
          </div>
          
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Reconnect Attempts:</span>
            <span className="font-medium">{reconnectAttempts}</span>
          </div>
          
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Messages Received:</span>
            <span className="font-medium">{messagesReceived}</span>
          </div>
          
          {lastMessage && (
            <div className="mt-2">
              <span className="text-gray-600">Last Message:</span>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                {typeof lastMessage === 'string' ? lastMessage : JSON.stringify(lastMessage, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="flex gap-2 mt-3">
            <button
              onClick={onReconnect}
              className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
              type="button"
            >
              Force Reconnect
            </button>
            
            <button
              onClick={onSimulate}
              className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
              type="button"
            >
              Simulate Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom Toast notification component
const Toast = React.memo(({ id, type, message, onClose, onMouseEnter, onMouseLeave }) => {
  const typeClasses = {
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/20',
    error: 'bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/20',
    loading: 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20',
    default: 'bg-gradient-to-r from-gray-700 to-gray-800 shadow-lg shadow-gray-500/20',
  };
  
  const iconMap = {
    success: <FiCheckCircle className="h-5 w-5 text-white" />,
    error: <FiAlertCircle className="h-5 w-5 text-white" />,
    loading: (
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
    ),
    default: <FiBell className="h-5 w-5 text-white" />,
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${typeClasses[type] || typeClasses.default} text-white rounded-xl px-4 py-3 flex items-center shadow-lg max-w-sm w-full mx-auto pointer-events-auto`}
      role="alert"
    >
      <div className="mr-3 flex-shrink-0">{iconMap[type] || iconMap.default}</div>
      <div className="flex-1 mr-2 text-sm font-medium">{message}</div>
      {type !== 'loading' && (
        <button 
          onClick={() => onClose(id)}
          className="flex-shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
          type="button"
        >
          <FiX className="h-4 w-4 text-white" />
        </button>
      )}
    </motion.div>
  );
});

// Custom toast container component
const ToastContainer = React.memo(({ toasts, removeToast, pauseToast, resumeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 min-w-[320px] max-w-[420px]">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onClose={removeToast}
            onMouseEnter={() => pauseToast(toast.id)}
            onMouseLeave={() => resumeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

// Toast notification context
const ToastContext = React.createContext(null);

// Toast provider component
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastTimeoutsRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    if (toastTimeoutsRef.current.has(id)) {
      clearTimeout(toastTimeoutsRef.current.get(id));
      toastTimeoutsRef.current.delete(id);
    }
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const createToast = useCallback((message, type = 'default', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
    
    if (type !== 'loading' && duration > 0) {
      const timeoutId = setTimeout(() => {
        removeToast(id);
      }, duration);
      
      toastTimeoutsRef.current.set(id, timeoutId);
    }
    
    return id;
  }, [removeToast]);

  const pauseToast = useCallback((id) => {
    if (toastTimeoutsRef.current.has(id)) {
      clearTimeout(toastTimeoutsRef.current.get(id));
    }
  }, []);

  const resumeToast = useCallback((id) => {
    const toast = toasts.find((t) => t.id === id);
    if (toast && toast.type !== 'loading') {
      if (toastTimeoutsRef.current.has(id)) {
        clearTimeout(toastTimeoutsRef.current.get(id));
      }
      const timeoutId = setTimeout(() => {
        removeToast(id);
      }, 4000);
      toastTimeoutsRef.current.set(id, timeoutId);
    }
  }, [toasts, removeToast]);

  const updateToast = useCallback((id, message, type) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) =>
        toast.id === id ? { ...toast, message, type } : toast
      )
    );
    
    if (type !== 'loading') {
      if (toastTimeoutsRef.current.has(id)) {
        clearTimeout(toastTimeoutsRef.current.get(id));
      }
      
      const timeoutId = setTimeout(() => {
        removeToast(id);
      }, 4000);
      
      toastTimeoutsRef.current.set(id, timeoutId);
    }
  }, [removeToast]);
  
  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      toast: (message) => createToast(message, 'default'),
      success: (message) => {
        const id = createToast(message, 'success');
        return id;
      },
      error: (message) => createToast(message, 'error'),
      loading: (message) => createToast(message, 'loading', 0),
      update: updateToast,
      remove: removeToast,
    }),
    [createToast, updateToast, removeToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
        pauseToast={pauseToast}
        resumeToast={resumeToast}
      />
    </ToastContext.Provider>
  );
};

// Hook to use toast
const useToast = () => {
  const context = React.useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Confirmation modal component for delete operations
const ConfirmationModal = React.memo(({ 
  isOpen, 
  title, 
  message, 
  confirmText, 
  cancelText, 
  onConfirm, 
  onCancel,
  type = "danger" // "danger" or "warning"
}) => {
  if (!isOpen) return null;

  const typeClasses = {
    danger: {
      icon: <FiTrash2 className="h-10 w-10 text-red-500" />,
      button: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
      bg: "bg-red-50"
    },
    warning: {
      icon: <FiAlertCircle className="h-10 w-10 text-amber-500" />,
      button: "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700",
      bg: "bg-amber-50"
    }
  };

  const classes = typeClasses[type] || typeClasses.danger;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
      >
        <div className={`${classes.bg} p-6 flex items-center justify-center`}>
          <div className="rounded-full bg-white p-3 shadow-sm">
            {classes.icon}
          </div>
        </div>
        
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          
          <div className="flex justify-end space-x-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium"
              type="button"
            >
              {cancelText || "Cancel"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onConfirm}
              className={`px-4 py-2 rounded-lg text-white shadow-sm text-sm font-medium ${classes.button} transition-colors`}
              type="button"
            >
              {confirmText || "Confirm"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

// Optimized lab request row component
const LabRequestRow = React.memo(({ 
  request, 
  onViewDetails, 
  onAssign, 
  onUpdateStatus,
  onDeleteRequest,
  currentTechnicianId,
  formatDate,
  isNewRequest
}) => {
  const isOverdue = request.due_date && new Date(request.due_date) < new Date();
  
  return (
    <motion.tr 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150 ${isNewRequest ? 'animate-pulse-light' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap font-medium">
        <div className="flex items-center">
          <span className="text-blue-600">
            {request.id.substring(0, 8)}
          </span>
          {isOverdue && 
            <span className="ml-1.5 text-red-600 animate-pulse">
              <FiAlertCircle size={14} />
            </span>
          }
          {isNewRequest && 
            <span className="ml-1.5 text-green-500">
              <span className="inline-flex relative h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </span>
          }
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {request.patient_details?.full_name || 
           request.patient_name ||
           `${request.patient_details?.first_name || ''} ${request.patient_details?.last_name || ''}` || 
           'Patient'}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">ID: {(request.patient_id || '').substring(0, 8) || 'N/A'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <MdOutlineBiotech className="mr-2 h-5 w-5 text-blue-500" />
          <span className="text-sm text-gray-900">
            {TEST_TYPES[request.test_type] || request.test_type}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <PriorityBadge priority={request.priority || request.urgency || 'ROUTINE'} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center">
          <FiClock className="mr-1.5 h-3.5 w-3.5 opacity-70" />
          <span>{formatDate(request.requested_at || request.created_at)}</span>
        </div>
        {request.due_date && (
          <div className={`text-xs flex items-center mt-1.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
            <FiCalendar className="mr-1 h-3 w-3" /> 
            Due: {formatDate(request.due_date)}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge status={request.status || 'PENDING'} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex space-x-1">
          {/* View details action */}
          <button
            onClick={() => onViewDetails(request.id)}
            className="p-1.5 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition-colors"
            title="View Details"
            type="button"
          >
            <FiFileText className="h-4 w-4" />
          </button>
          
          {/* Assign to self action (if not assigned) */}
          {!request.technician_id && (
            <button
              onClick={() => onAssign(request.id)}
              className="p-1.5 rounded-full text-purple-600 hover:text-purple-800 hover:bg-purple-100 transition-colors"
              title="Assign to Me"
              type="button"
            >
              <FiUserPlus className="h-4 w-4" />
            </button>
          )}
          
          {/* Status change actions - only show for assigned technician */}
          {request.technician_id === currentTechnicianId && (
            <>
              {request.status === 'PENDING' && (
                <button
                  onClick={() => onUpdateStatus(request.id, 'IN_PROGRESS')}
                  className="p-1.5 rounded-full text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition-colors"
                  title="Start Processing"
                  type="button"
                >
                  <FiActivity className="h-4 w-4" />
                </button>
              )}
              
              {request.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => onUpdateStatus(request.id, 'COMPLETED')}
                  className="p-1.5 rounded-full text-green-600 hover:text-green-800 hover:bg-green-100 transition-colors"
                  title="Complete Test"
                  type="button"
                >
                  <FiCheckCircle className="h-4 w-4" />
                </button>
              )}
            </>
          )}
          
          {/* Delete action - only for non-completed requests */}
          {request.status !== 'COMPLETED' && (
            <button
              onClick={() => onDeleteRequest(request.id, TEST_TYPES[request.test_type] || request.test_type)}
              className="p-1.5 rounded-full text-red-600 hover:text-red-800 hover:bg-red-100 transition-colors"
              title="Delete Request"
              type="button"
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
});

// Priority badge component with React.memo to prevent unnecessary re-renders
const PriorityBadge = React.memo(({ priority }) => {
  // Normalize priority value
  let normalizedPriority = priority;
  if (typeof priority === 'string') {
    if (priority.toUpperCase() === 'MEDIUM' || priority === 'medium') {
      normalizedPriority = 'ROUTINE';
    } else if (priority.toUpperCase() === 'HIGH' || priority === 'high') {
      normalizedPriority = 'URGENT';
    } else if (priority.toUpperCase() === 'CRITICAL' || priority === 'critical') {
      normalizedPriority = 'EMERGENCY';
    }
  }
  
  const colors = PRIORITY_COLORS[normalizedPriority] || PRIORITY_COLORS.ROUTINE;
  const iconSize = 14;
  
  return (
    <span className={`px-2.5 py-1 inline-flex items-center text-xs leading-none font-medium rounded-full bg-gradient-to-r ${colors.gradient} text-white shadow-sm ${colors.shadow}`}>
      {normalizedPriority !== 'ROUTINE' && <MdPriorityHigh className="mr-1" size={iconSize} />}
      {TEST_PRIORITIES[normalizedPriority] || TEST_PRIORITIES[priority] || priority}
    </span>
  );
});

// Status badge component with React.memo to prevent unnecessary re-renders
const StatusBadge = React.memo(({ status }) => {
  // Normalize status
  let normalizedStatus = status;
  if (typeof status === 'string') {
    normalizedStatus = status.toUpperCase();
    if (normalizedStatus === 'IN_PROGRESS' || normalizedStatus === 'IN PROGRESS') {
      normalizedStatus = 'IN_PROGRESS';
    }
  }
  
  const colors = STATUS_COLORS[normalizedStatus] || STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  
  return (
    <span className={`px-2.5 py-1 inline-flex items-center text-xs leading-none font-medium rounded-full bg-gradient-to-r ${colors.gradient} text-white shadow-sm ${colors.shadow}`}>
      {colors.icon}
      {TEST_STATUS[normalizedStatus] || TEST_STATUS[status] || status}
    </span>
  );
});

// Skeleton loader for table rows
const TableRowSkeleton = () => (
  <tr className="border-b border-gray-200 animate-pulse">
    {[...Array(7)].map((_, index) => (
      <td key={index} className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
        {index === 1 && <div className="h-3 bg-gray-200 rounded w-16 mt-2"></div>}
      </td>
    ))}
  </tr>
);

// TableHeaderSkeleton component
const TableHeaderSkeleton = () => (
  <thead className="bg-gray-50">
    <tr>
      {[...Array(7)].map((_, index) => (
        <th key={index} className="px-6 py-3 text-left">
          <div className="h-3 bg-gray-200 rounded w-16"></div>
        </th>
      ))}
    </tr>
  </thead>
);

// Empty state component
const EmptyState = React.memo(({ message, onRefresh }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-12"
  >
    <div className="p-3 bg-gray-100 rounded-full mb-4">
      <FiSearch className="h-10 w-10 text-gray-400" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
    <p className="text-gray-500 text-center max-w-md mb-6">{message}</p>
    <button
      onClick={onRefresh}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      type="button"
    >
      <FiX className="mr-2 h-4 w-4" />
      Clear filters
    </button>
  </motion.div>
));

// WebSocket Status Indicator Component
const WebSocketStatus = ({ status, messagesReceived, activeConnections, onReconnect, lastMessage, onSimulate }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'disconnected': return 'bg-red-500';
      default: 
        if (status.includes('reconnecting')) return 'bg-yellow-500';
        return 'bg-gray-500';
    }
  };
  
  const getAnimationClass = (status) => {
    if (status === 'connected') return '';
    return 'animate-pulse';
  };
  
  return (
    <div className="relative">
      <div 
        className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className={`inline-block h-3 w-3 rounded-full mr-2 ${getStatusColor(status)} ${getAnimationClass(status)}`}></span>
        <span className="text-sm text-gray-600 capitalize">{status.replace(/_/g, ' ')}</span>
        {messagesReceived > 0 && <span className="ml-2 text-xs text-gray-500">({messagesReceived} msgs)</span>}
        {activeConnections > 0 && <span className="ml-2 text-xs text-green-500">({activeConnections} conn)</span>}
      </div>
      
      {showDetails && (
        <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg p-4 w-80 z-10 border border-gray-200">
          <div className="flex justify-between mb-3">
            <h4 className="text-sm font-medium">WebSocket Status</h4>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600"
              type="button"
            >
              <FiX size={16} />
            </button>
          </div>
          
          <div className="text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Status:</span>
              <span className="font-medium capitalize">{status.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Messages Received:</span>
              <span className="font-medium">{messagesReceived}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Active Connections:</span>
              <span className="font-medium">{activeConnections}</span>
            </div>
            
            {lastMessage && (
              <div className="mt-2">
                <div className="text-gray-500 mb-1">Last Message:</div>
                <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                  {typeof lastMessage === 'string' ? lastMessage : JSON.stringify(lastMessage, null, 2)}
                </pre>
              </div>
            )}
            
            <div className="flex gap-2 mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReconnect();
                  setShowDetails(false);
                }}
                className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs font-medium flex items-center justify-center"
                type="button"
              >
                <FiChevronDown className="mr-1 h-3 w-3" /> Reconnect
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSimulate();
                  setShowDetails(false);
                }}
                className="flex-1 px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs font-medium flex items-center justify-center"
                type="button"
              >
                <FiPlay className="mr-1 h-3 w-3" /> Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main component
function LabRequestsList() {
  // Initialize audio on component mount
  useEffect(() => {
    // Set up user interaction detector to enable audio
    const handleUserInteraction = () => {
      notificationSound.play().then(() => {
        // Immediately pause to avoid playing the sound but initialize audio context
        notificationSound.pause();
        notificationSound.currentTime = 0;
        console.log("Audio initialized by user interaction");
      }).catch(err => {
        console.error("Error initializing audio:", err);
      });
    };
    
    // Listen for user interaction once
    document.addEventListener('click', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
    };
  }, []);
  
  return (
    <ToastProvider>
      <LabRequestsContent />
    </ToastProvider>
  );
}

// Actual implementation moved to a separate component that will be wrapped by ToastProvider
function LabRequestsContent() {
  // States
  const [labRequests, setLabRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  
  // Store new request IDs to mark them in the UI
  const [newRequestIds, setNewRequestIds] = useState(new Set());
  
  // Track if initial data has been loaded
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  // Critical flag to prevent polling issues
  const [isChangingPage, setIsChangingPage] = useState(false);
  const currentPageRef = useRef(1); // Keep a ref to the current page to avoid stale values in callbacks

  // Prevents rapid page change issues
  const pageChangeTimeoutRef = useRef(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [testTypeFilter, setTestTypeFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState({
    fromDate: '',
    toDate: ''
  });
  
  // Detail view
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editRequestData, setEditRequestData] = useState(null);
  
  // Confirmation modals
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    requestId: null,
    requestType: ''
  });
  
  // Settings dropdown
  const [showSettings, setShowSettings] = useState(false);
  
  // Current technician ID (would come from auth context in a real app)
  const [currentTechnicianId, setCurrentTechnicianId] = useState('3fa85f64-5717-4562-b3fc-2c963f66afa6');
  
  // New requests counter
  const [newRequestsCount, setNewRequestsCount] = useState(0);
  const allKnownRequestsRef = useRef(new Set()); // To track all requests across all pages
  
  // Selected request cached ID for polling when modal is open
  const selectedRequestIdRef = useRef(null);

  // Keep track of the last fetched page 
  const lastFetchedPageRef = useRef(1);
  
  // Use custom toast - now safely called inside a component wrapped by ToastProvider
  const toast = useToast();
  
  // Debugging aid - captured lab requests
  const [capturedRequests, setCapturedRequests] = useState([]);
  
  // Handler for new requests from WebSocket
  const handleNewRequest = useCallback((requestData) => {
    // Skip refresh-only messages
    if (requestData.refreshOnly) {
      console.log(`Refreshing due to ${requestData.type} for request ${requestData.id}`);
      setTimeout(() => {
        fetchLabRequests(false, currentPageRef.current);
      }, 500);
      return;
    }
    
    console.log("%c LAB REQUEST RECEIVED!", "background: #4caf50; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;", requestData);
    
    if (!requestData || !requestData.id) {
      console.warn("Received invalid lab request data:", requestData);
      return;
    }
    
    // Add to debugging capture
    setCapturedRequests(prev => [requestData, ...prev].slice(0, 10));
    
    // Check if we already know about this request
    if (allKnownRequestsRef.current.has(requestData.id)) {
      console.log("Ignoring duplicate lab request:", requestData.id);
      return;
    }
    
    // Add to known requests
    allKnownRequestsRef.current.add(requestData.id);
    
    // Add to new requests set
    setNewRequestIds(prev => {
      const newSet = new Set(prev);
      newSet.add(requestData.id);
      return newSet;
    });
    
    // Increment new requests counter
    setNewRequestsCount(prev => prev + 1);
    
    // If we're on the first page, add the new request to the top of the list
    if (page === 1) {
      // Make sure we have all the required fields with defaults if needed
      const normalizedRequest = {
        ...requestData,
        // Set default values for required fields if not present
        status: requestData.status || 'pending',
        priority: requestData.priority || requestData.urgency || 'medium',
        requested_at: requestData.requested_at || requestData.created_at || new Date().toISOString(),
        patient_id: requestData.patient_id || 'Unknown',
        test_type: requestData.test_type || 'Unknown',
        // If patient name is included directly, create a placeholder patient_details
        patient_details: requestData.patient_details || (requestData.patient_name ? { full_name: requestData.patient_name } : undefined)
      };
      
      console.log("Adding new lab request to the list:", normalizedRequest);
      setLabRequests(prev => [normalizedRequest, ...prev]);
    }
    
    // Play notification sound and show toast
    if (notificationsEnabled) {
      playNotificationSound();
      toast.success(`New lab request received: ${TEST_TYPES[requestData.test_type] || requestData.test_type || 'Unknown test'}`);
    }
    
    // Force a refresh of the lab requests list to ensure we have the latest data
    setTimeout(() => {
      console.log("Forcing refresh of lab requests after WebSocket notification");
      fetchLabRequests(false, currentPageRef.current);
    }, 500);
  }, [page, notificationsEnabled, toast]);
  
  // Set up WebSocket connection
  const { 
    connected: wsConnected,
    connectionStatus: wsStatus,
    messagesReceived: wsMessagesReceived,
    lastMessage: wsLastMessage,
    reconnectAttempts: wsReconnectAttempts,
    activeConnections: wsActiveConnections,
    connect: wsReconnect,
    simulateLabRequest: wsSimulateRequest
  } = useLabRequestsWebSocket(currentTechnicianId, handleNewRequest);
  
  // Count active filters
  useEffect(() => {
    let count = 0;
    if (statusFilter) count++;
    if (priorityFilter) count++;
    if (testTypeFilter) count++;
    if (dateRangeFilter.fromDate) count++;
    if (dateRangeFilter.toDate) count++;
    setActiveFiltersCount(count);
  }, [statusFilter, priorityFilter, testTypeFilter, dateRangeFilter]);
  
  // Save notification settings
  useEffect(() => {
    localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  // Custom notification function that plays sound if enabled
  const notify = useCallback((message, type = 'success') => {
    if (!notificationsEnabled && type !== 'loading') return;
    
    let toastId;
    
    switch (type) {
      case 'success':
        toastId = toast.success(message);
        break;
      case 'error':
        toastId = toast.error(message);
        break;
      case 'loading':
        toastId = toast.loading(message);
        break;
      default:
        toastId = toast.toast(message);
    }
    
    // Play notification sound if it's enabled and not a loading notification
    if (type !== 'loading' && notificationsEnabled) {
      // Always try to play the sound when a notification appears
      playNotificationSound();
      console.log("Notification triggered with sound");
    }
    
    return toastId;
  }, [notificationsEnabled, toast]);
  
  // Function to simulate a lab request for testing
  const simulateLabRequest = useCallback(() => {
    const mockRequest = wsSimulateRequest();
    notify(`Test lab request received: ${TEST_TYPES[mockRequest.test_type] || mockRequest.test_type}`, 'success');
  }, [wsSimulateRequest, notify]);

  // Update currentPageRef when page changes
  useEffect(() => {
    currentPageRef.current = page;
    
    // Mark that we're changing pages to stop polling temporarily
    setIsChangingPage(true);
    
    // Clear any existing timeout
    if (pageChangeTimeoutRef.current) {
      clearTimeout(pageChangeTimeoutRef.current);
    }
    
    // Set a timeout to re-enable polling after the page change is complete
    pageChangeTimeoutRef.current = setTimeout(() => {
      setIsChangingPage(false);
    }, 2000); // 2 second delay before resuming normal polling
    
    // Reset new request detection when changing pages
    setNewRequestIds(new Set());
    setNewRequestsCount(0);
    
    return () => {
      if (pageChangeTimeoutRef.current) {
        clearTimeout(pageChangeTimeoutRef.current);
      }
    };
  }, [page]);

  // Helper function to detect new requests
  const detectNewRequests = useCallback((currentRequests) => {
    // Skip detection during page changes
    if (isChangingPage) {
      // Just update the tracking
      currentRequests.forEach(request => {
        allKnownRequestsRef.current.add(request.id);
      });
      return new Set();
    }
    
    const newIds = new Set();
    
    // Only look for new requests
    for (const request of currentRequests) {
      if (!allKnownRequestsRef.current.has(request.id)) {
        newIds.add(request.id);
        // Add to known requests
        allKnownRequestsRef.current.add(request.id);
      }
    }
    
    return newIds;
  }, [isChangingPage]);

  // Fetch lab requests with explicit pagination safeguards
  const fetchLabRequests = useCallback(async (showLoadingState = true, forcedPage = null) => {
    // Use the forced page if provided, otherwise use the current page state
    const pageToFetch = forcedPage !== null ? forcedPage : page;
    
    // Don't fetch if we're changing pages and not forcing a specific page
    if (isChangingPage && forcedPage === null) {
      return;
    }
    
    if (showLoadingState) {
      setLoading(true);
    }
    
    setError(null);
    
    // Store this as the last page we fetched
    lastFetchedPageRef.current = pageToFetch;
    
    try {
      let url = `http://localhost:8025/api/lab-requests?page=${pageToFetch}&size=${pageSize}`;
      
      if (statusFilter) url += `&status=${statusFilter}`;
      if (priorityFilter) url += `&priority=${priorityFilter}`;
      if (testTypeFilter) url += `&test_type=${testTypeFilter}`;
      if (dateRangeFilter.fromDate) url += `&from_date=${dateRangeFilter.fromDate}`;
      if (dateRangeFilter.toDate) url += `&to_date=${dateRangeFilter.toDate}`;
      if (currentTechnicianId) url += `&labtechnician_id=${currentTechnicianId}`;
      
      console.log("Fetching lab requests from:", url);
      const response = await axios.get(url);
      console.log("API response:", response.data);
      
      // Only look for new requests if this isn't an initial load and we're not changing pages
      if (initialDataLoaded && !isChangingPage && !showLoadingState) {
        const currentNewIds = detectNewRequests(response.data.items);
        
        // If there are new requests, update the count and notify
        if (currentNewIds.size > 0) {
          setNewRequestsCount(prevCount => prevCount + currentNewIds.size);
          setNewRequestIds(prevIds => new Set([...prevIds, ...currentNewIds]));
          
          if (notificationsEnabled) {
            // Force play sound for new requests
            setTimeout(() => {
              notify(`${currentNewIds.size} new lab request${currentNewIds.size === 1 ? '' : 's'} received`, 'success');
            }, 100);
          }
        }
      } else if (!initialDataLoaded) {
        // If this is the initial load, add all requests to our known list
        response.data.items.forEach(request => {
          allKnownRequestsRef.current.add(request.id);
        });
      }
      
      // Update the data only if this was requested for the current page
      // or if this is a forced fetch (manual refresh)
      if (pageToFetch === currentPageRef.current || forcedPage !== null) {
        setLabRequests(response.data.items);
        setTotalPages(response.data.pages);
        setTotalRequests(response.data.total);
      }
      
      setInitialDataLoaded(true);
      
    } catch (err) {
      console.error('Failed to fetch lab requests:', err);
      setError('Failed to load lab requests. Please try again.');
      if (showLoadingState) {
        notify('Failed to load lab requests', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, priorityFilter, testTypeFilter, dateRangeFilter, currentTechnicianId, notify, detectNewRequests, notificationsEnabled, initialDataLoaded, isChangingPage]);

  // Load data immediately on mount
  useEffect(() => {
    // Fetch real data immediately
    fetchLabRequests(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty dependency array for first load only

  // Refetch when pagination changes, but with safeguards for during the change
  useEffect(() => {
    if (initialDataLoaded && !isChangingPage) {
      fetchLabRequests(true);
    }
  }, [page, pageSize, fetchLabRequests, initialDataLoaded, isChangingPage]);

  // Clear new request markers
  const clearNewRequestMarkers = useCallback(() => {
    setNewRequestIds(new Set());
    setNewRequestsCount(0);
  }, []);

  // Fetch lab request details
  const fetchRequestDetails = useCallback(async (requestId) => {
    const loadingToast = notify('Loading request details...', 'loading');
    
    try {
      const response = await axios.get(
        `http://localhost:8025/api/lab-requests/${requestId}?include_details=true&labtechnician_id=${currentTechnicianId}`
      );
      
      console.log("Fetched request details:", response.data);
      
      setSelectedRequest(response.data);
      setShowDetailModal(true);
      selectedRequestIdRef.current = requestId;
      
      // Initialize edit data
      setEditRequestData({
        priority: response.data.priority,
        status: response.data.status,
        notes: response.data.notes || '',
        technician_id: response.data.technician_id || currentTechnicianId
      });
      
      // Remove from new requests if it was marked as new
      if (newRequestIds.has(requestId)) {
        setNewRequestIds(prevIds => {
          const newIds = new Set(prevIds);
          newIds.delete(requestId);
          return newIds;
        });
        
        if (newRequestsCount > 0) {
          setNewRequestsCount(prevCount => Math.max(0, prevCount - 1));
        }
      }
      
      toast.remove(loadingToast);
      
    } catch (err) {
      console.error('Failed to fetch request details:', err);
      toast.remove(loadingToast);
      notify('Failed to load request details', 'error');
    }
  }, [currentTechnicianId, notify, newRequestIds, newRequestsCount, toast]);

  // Pagination handler with explicit safeguards
  const handlePageChange = useCallback((newPage) => {
    // Don't allow page changes while another is in progress
    if (isChangingPage) return;
    
    setPage(newPage);
  }, [isChangingPage]);

  // Update request status with optimistic UI updates
  const updateRequestStatus = useCallback(async (requestId, newStatus) => {
    // Optimistically update UI
    setLabRequests(prevRequests => 
      prevRequests.map(request => 
        request.id === requestId ? { ...request, status: newStatus } : request
      )
    );
    
    // If the detail modal is open for this request, update it too
    if (selectedRequest && selectedRequest.id === requestId) {
      setSelectedRequest(prev => ({ ...prev, status: newStatus }));
      setEditRequestData(prev => ({ ...prev, status: newStatus }));
    }
    
    const loadingToast = notify(`Updating status to ${TEST_STATUS[newStatus]}...`, 'loading');
    
    try {
      await axios.patch(
        `http://localhost:8025/api/lab-requests/${requestId}?labtechnician_id=${currentTechnicianId}`,
        { status: newStatus }
      );
      
      toast.remove(loadingToast);
      notify(`Request status updated to ${TEST_STATUS[newStatus]}`, 'success');
      
      // Refresh the data after a short delay to ensure backend processed the update
      setTimeout(() => {
        fetchLabRequests(false, currentPageRef.current);
        
        // If detail view is open, refresh it
        if (selectedRequest && selectedRequest.id === requestId) {
          fetchRequestDetails(requestId);
        }
      }, 500);
    } catch (err) {
      console.error('Failed to update request status:', err);
      toast.remove(loadingToast);
      notify('Failed to update request status', 'error');
      
      // Revert optimistic update on failure
      fetchLabRequests(false, currentPageRef.current);
      
      // If detail view is open, refresh it
      if (selectedRequest && selectedRequest.id === requestId) {
        fetchRequestDetails(requestId);
      }
    }
  }, [currentTechnicianId, selectedRequest, fetchLabRequests, fetchRequestDetails, notify, toast]);

  // Assign request to current technician
  const assignToSelf = useCallback(async (requestId) => {
    // Optimistically update local state
    setLabRequests(prevRequests => 
      prevRequests.map(request => 
        request.id === requestId 
          ? { ...request, technician_id: currentTechnicianId, status: 'IN_PROGRESS' } 
          : request
      )
    );
    
    // Update selected request if detail modal is open
    if (selectedRequest && selectedRequest.id === requestId) {
      setSelectedRequest(prev => ({ 
        ...prev, 
        technician_id: currentTechnicianId,
        status: 'IN_PROGRESS'
      }));
      setEditRequestData(prev => ({
        ...prev,
        technician_id: currentTechnicianId,
        status: 'IN_PROGRESS'
      }));
    }
    
    const loadingToast = notify('Assigning request to you...', 'loading');
    
    try {
      await axios.patch(
        `http://localhost:8025/api/lab-requests/${requestId}?labtechnician_id=${currentTechnicianId}`,
        { 
          technician_id: currentTechnicianId,
          status: 'IN_PROGRESS'
        }
      );
      
      toast.remove(loadingToast);
      notify('Request assigned to you', 'success');
      
      // Refresh the data after a short delay
      setTimeout(() => {
        fetchLabRequests(false, currentPageRef.current);
        
        // If detail view is open, refresh it
        if (selectedRequest && selectedRequest.id === requestId) {
          fetchRequestDetails(requestId);
        }
      }, 500);
    } catch (err) {
      console.error('Failed to assign request:', err);
      toast.remove(loadingToast);
      notify('Failed to assign request', 'error');
      
      // Revert optimistic update on failure
      fetchLabRequests(false, currentPageRef.current);
      
      // If detail view is open, refresh it
      if (selectedRequest && selectedRequest.id === requestId) {
        fetchRequestDetails(requestId);
      }
    }
  }, [currentTechnicianId, selectedRequest, fetchLabRequests, fetchRequestDetails, notify, toast]);

  // Delete lab request
  const deleteLabRequest = useCallback(async (requestId) => {
    const loadingToast = notify('Deleting request...', 'loading');
    
    try {
      await axios.delete(
        `http://localhost:8025/api/lab-requests/${requestId}?labtechnician_id=${currentTechnicianId}`
      );
      
      toast.remove(loadingToast);
      notify('Lab request has been deleted', 'success');
      
      // Close detail modal if it's the deleted request
      if (selectedRequest && selectedRequest.id === requestId) {
        setShowDetailModal(false);
      }
      
      // Refresh the data
      setTimeout(() => {
        fetchLabRequests(true, currentPageRef.current);
      }, 500);
      
    } catch (err) {
      console.error('Failed to delete request:', err);
      toast.remove(loadingToast);
      
      // Error handling based on response
      if (err.response && err.response.status === 400) {
        notify('Cannot delete a completed lab request', 'error');
      } else {
        notify('Failed to delete lab request', 'error');
      }
    }
  }, [currentTechnicianId, fetchLabRequests, notify, selectedRequest, toast]);

  // Confirm delete handler
  const handleDeleteConfirmation = useCallback((requestId, requestType) => {
    setDeleteConfirmation({
      isOpen: true,
      requestId,
      requestType
    });
  }, []);

  // Execute delete after confirmation
  const confirmDelete = useCallback(() => {
    const { requestId } = deleteConfirmation;
    
    // Close confirmation modal
    setDeleteConfirmation({
      isOpen: false,
      requestId: null,
      requestType: ''
    });
    
    // Proceed with deletion
    if (requestId) {
      deleteLabRequest(requestId);
    }
  }, [deleteConfirmation, deleteLabRequest]);

  // Cancel delete confirmation
  const cancelDelete = useCallback(() => {
    setDeleteConfirmation({
      isOpen: false,
      requestId: null,
      requestType: ''
    });
  }, []);

  // Update lab request with all fields
  const updateLabRequest = useCallback(async () => {
    if (!selectedRequest || !editRequestData) return;
    
    const loadingToast = notify('Updating lab request...', 'loading');
    
    // Prepare update data
    const updateData = {};
    
    // Only include fields that have changed
    if (editRequestData.priority !== selectedRequest.priority) {
      updateData.priority = editRequestData.priority;
    }
    
    if (editRequestData.status !== selectedRequest.status) {
      updateData.status = editRequestData.status;
    }
    
    if (editRequestData.notes !== (selectedRequest.notes || '')) {
      updateData.notes = editRequestData.notes;
    }
    
    if (editRequestData.technician_id !== selectedRequest.technician_id) {
      updateData.technician_id = editRequestData.technician_id;
    }
    
    // If nothing changed, just exit edit mode
    if (Object.keys(updateData).length === 0) {
      toast.remove(loadingToast);
      setIsEditMode(false);
      return;
    }
    
    try {
      // Call the API
      await axios.patch(
        `http://localhost:8025/api/lab-requests/${selectedRequest.id}?labtechnician_id=${currentTechnicianId}`,
        updateData
      );
      
      toast.remove(loadingToast);
      notify('Lab request updated successfully', 'success');
      
      // Exit edit mode
      setIsEditMode(false);
      
      // Refresh the data
      fetchLabRequests(false, currentPageRef.current);
      
      // Refresh the detail view
      fetchRequestDetails(selectedRequest.id);
      
    } catch (err) {
      console.error('Failed to update lab request:', err);
      toast.remove(loadingToast);
      
      if (err.response && err.response.data && err.response.data.detail) {
        notify(`Error: ${err.response.data.detail}`, 'error');
      } else {
        notify('Failed to update lab request', 'error');
      }
    }
  }, [selectedRequest, editRequestData, currentTechnicianId, notify, toast, fetchLabRequests, fetchRequestDetails]);

  // Format date for display
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = parseISO(dateString);
      
      if (isToday(date)) {
        return `Today, ${format(date, 'h:mm a')}`;
      } else if (isYesterday(date)) {
        return `Yesterday, ${format(date, 'h:mm a')}`;
      } else {
        return format(date, 'MMM d, yyyy h:mm a');
      }
    } catch (err) {
      console.error('Date parsing error:', err);
      return dateString;
    }
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setStatusFilter('');
    setPriorityFilter('');
    setTestTypeFilter('');
    setDateRangeFilter({ fromDate: '', toDate: '' });
    setSearchTerm('');
    handlePageChange(1); // Safe page change to 1
    notify('Filters cleared', 'success');
  }, [notify, handlePageChange]);

  // Memoize filtered requests to prevent unnecessary re-renders
  const filteredRequests = useMemo(() => {
    if (!searchTerm) return labRequests;
    
    const searchTermLower = searchTerm.toLowerCase();
    
    return labRequests.filter(request => {
      // Search relevant fields
      return (
        (request.patient_details && request.patient_details.full_name?.toLowerCase().includes(searchTermLower)) ||
        (request.patient_name && request.patient_name.toLowerCase().includes(searchTermLower)) ||
        (request.patient_id && request.patient_id.toLowerCase().includes(searchTermLower)) ||
        (request.test_type && request.test_type.toLowerCase().includes(searchTermLower)) ||
        (request.id && request.id.toLowerCase().includes(searchTermLower))
      );
    });
  }, [labRequests, searchTerm]);

  // Detail modal component with edit functionality
  const DetailModal = React.memo(({ 
    request, 
    onClose, 
    onAssign, 
    onUpdateStatus,
    onDelete,
    formatDate,
    currentTechnicianId,
    isEditMode,
    editData,
    setEditData,
    onSaveChanges,
    onToggleEditMode
  }) => {
    if (!request) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200"
        >
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl backdrop-blur-lg bg-opacity-90">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditMode ? "Edit Lab Request" : "Lab Request Details"}
            </h2>
            <div className="flex items-center gap-2">
              {!isEditMode && request.status !== "COMPLETED" && (
                <button
                  onClick={onToggleEditMode}
                  className="p-1.5 rounded-full text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition-colors"
                  title="Edit Request"
                  type="button"
                >
                  <FiEdit className="h-5 w-5" />
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Close"
                type="button"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                  <FiFileText className="mr-2 h-4 w-4 text-blue-500" />
                  Request Information
                </h3>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Request ID</p>
                      <p className="text-sm font-medium text-gray-900">{request.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Test Type</p>
                      <p className="text-sm font-medium text-gray-900 flex items-center">
                        <MdOutlineBiotech className="mr-1.5 h-4 w-4 text-blue-500" />
                        {TEST_TYPES[request.test_type] || request.test_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Priority</p>
                      {isEditMode ? (
                        <select
                          value={editData.priority}
                          onChange={(e) => setEditData({...editData, priority: e.target.value})}
                          className="block w-full rounded text-sm py-1.5 border-gray-300 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="EMERGENCY">Emergency</option>
                        </select>
                      ) : (
                        <PriorityBadge priority={request.priority} />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      {isEditMode ? (
                        <select
                          value={editData.status}
                          onChange={(e) => setEditData({...editData, status: e.target.value})}
                          className="block w-full rounded text-sm py-1.5 border-gray-300 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                          disabled={request.status === "COMPLETED"}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="canceled">Cancelled</option>
                        </select>
                      ) : (
                        <StatusBadge status={request.status} />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Requested At</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(request.requested_at || request.created_at)}</p>
                    </div>
                    {request.due_date && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Due Date</p>
                        <p className={`text-sm font-medium flex items-center ${
                          new Date(request.due_date) < new Date() 
                            ? 'text-red-600' 
                            : 'text-gray-900'
                        }`}>
                          <FiCalendar className="mr-1.5 h-3.5 w-3.5" />
                          {formatDate(request.due_date)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Patient Information
                </h3>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm">
                  {request.patient_details || request.patient_name ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Patient Name</p>
                        <p className="text-sm font-medium text-gray-900">
                          {request.patient_details?.full_name || 
                           request.patient_name ||
                           `${request.patient_details?.first_name || ''} ${request.patient_details?.last_name || ''}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Patient ID</p>
                        <p className="text-sm font-medium text-gray-900">{request.patient_id}</p>
                      </div>
                      {(request.patient_details?.age || request.patient_age) && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Age</p>
                          <p className="text-sm font-medium text-gray-900">{request.patient_details?.age || request.patient_age}</p>
                        </div>
                      )}
                      {(request.patient_details?.gender || request.patient_gender) && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Gender</p>
                          <p className="text-sm font-medium text-gray-900">{request.patient_details?.gender || request.patient_gender}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Patient information not available</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Request Notes
              </h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm">
                {isEditMode ? (
                  <textarea
                    value={editData.notes}
                    onChange={(e) => setEditData({...editData, notes: e.target.value})}
                    className="block w-full rounded border-gray-300 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    rows={4}
                    placeholder="Enter notes about this lab request..."
                  />
                ) : (
                  request.notes ? (
                    <p className="text-sm whitespace-pre-line text-gray-900">{request.notes}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No notes provided</p>
                  )
                )}
              </div>
            </div>
            
            {request.diagnosis_notes && (
              <div className="mt-6">
                <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                  <FiActivity className="h-4 w-4 mr-2 text-blue-500" />
                  Diagnosis Notes
                </h3>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm">
                  <p className="text-sm whitespace-pre-line text-gray-900">{request.diagnosis_notes}</p>
                </div>
              </div>
            )}
            
            {request.lab_result && (
              <div className="mt-6">
                <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center">
                  <FiCheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  Lab Results
                </h3>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Result Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(request.lab_result.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Result Status</p>
                      <p className="text-sm font-medium text-gray-900">{request.lab_result.status}</p>
                    </div>
                  </div>
                  
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Result Data</h4>
                  {request.lab_result.result_data ? (
                    <pre className="bg-gray-100 p-3 rounded overflow-x-auto text-xs text-gray-900 border border-gray-200">
                      {typeof request.lab_result.result_data === 'object' 
                        ? JSON.stringify(request.lab_result.result_data, null, 2)
                        : request.lab_result.result_data}
                    </pre>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No result data available</p>
                  )}
                  
                  {request.lab_result.images && request.lab_result.images.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Images</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {request.lab_result.images.map((image, idx) => (
                          <div key={idx} className="border rounded-lg overflow-hidden bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <img 
                              src={image.file_path || image.url} 
                              alt={`Result image ${idx + 1}`}
                              className="w-full h-auto"
                            />
                            <div className="p-2 text-xs text-center text-gray-500">
                              Image {idx + 1}
                              <a 
                                href={image.file_path || image.url} 
                                download={`result-${request.id}-image-${idx + 1}`}
                                className="ml-2 text-blue-600 hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FiDownload className="inline h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-8 border-t border-gray-200 pt-6 flex flex-wrap gap-3 justify-end">
              {isEditMode ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onToggleEditMode}
                    className="px-3 py-2 rounded-full text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center shadow-sm"
                    type="button"
                  >
                    <FiX className="mr-1.5 h-4 w-4" /> Cancel
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onSaveChanges}
                    className="px-3 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-colors flex items-center shadow-sm"
                    type="button"
                  >
                    <FiSave className="mr-1.5 h-4 w-4" /> Save Changes
                  </motion.button>
                </>
              ) : (
                <>
                  {!request.technician_id && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onAssign(request.id)}
                      className="px-3 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 transition-colors flex items-center shadow-sm"
                      type="button"
                    >
                      <FiUserPlus className="mr-1.5 h-4 w-4" /> Assign to Me
                    </motion.button>
                  )}
                  
                  {request.status === 'PENDING' && request.technician_id === currentTechnicianId && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onUpdateStatus(request.id, 'IN_PROGRESS')}
                      className="px-3 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center shadow-sm"
                      type="button"
                    >
                      <FiActivity className="mr-1.5 h-4 w-4" /> Start Processing
                    </motion.button>
                  )}
                  
                  {request.status === 'IN_PROGRESS' && request.technician_id === currentTechnicianId && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onUpdateStatus(request.id, 'COMPLETED')}
                      className="px-3 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-colors flex items-center shadow-sm"
                      type="button"
                    >
                      <FiCheckCircle className="mr-1.5 h-4 w-4" /> Complete
                    </motion.button>
                  )}
                  
                  {/* Delete button - only show for non-completed requests */}
                  {request.status !== 'COMPLETED' && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onDelete(request.id, TEST_TYPES[request.test_type] || request.test_type)}
                      className="px-3 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-colors flex items-center shadow-sm"
                      type="button"
                    >
                      <FiTrash2 className="mr-1.5 h-4 w-4" /> Delete Request
                    </motion.button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  });

  // Loading skeleton screen
  const LoadingSkeleton = () => (
    <div className="py-6">
      <div className="flex justify-center items-center mb-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="w-16 h-16 border-t-4 border-b-4 border-blue-600 rounded-full"
        />
      </div>
      <div className="px-6">
        <table className="min-w-full divide-y divide-gray-200">
          <TableHeaderSkeleton />
          <tbody className="divide-y divide-gray-200">
            {[...Array(6)].map((_, index) => (
              <TableRowSkeleton key={index} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-7 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 sm:text-3xl truncate">
              Laboratory Test Requests
            </h1>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 gap-2">
            {/* WebSocket status indicator */}
            <WebSocketStatus 
              status={wsStatus} 
              messagesReceived={wsMessagesReceived}
              activeConnections={wsActiveConnections}
              onReconnect={wsReconnect}
              lastMessage={wsLastMessage}
              onSimulate={simulateLabRequest}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors"
            >
              <FiSettings className="-ml-0.5 mr-2 h-4 w-4" />
              Settings
            </motion.button>
          </div>
        </div>

        {/* WebSocket Debug Panel */}
        <WebSocketDebug 
          status={wsStatus}
          connected={wsConnected}
          messagesReceived={wsMessagesReceived}
          reconnectAttempts={wsReconnectAttempts}
          lastMessage={wsLastMessage}
          activeConnections={wsActiveConnections}
          onReconnect={wsReconnect}
          onSimulate={simulateLabRequest}
        />

        {/* Header and Search Area */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-6 transition-colors">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div className="flex flex-wrap items-center gap-2">
                {newRequestsCount > 0 && (
                  <motion.button
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={clearNewRequestMarkers}
                    className="px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 rounded-full text-xs font-medium flex items-center hover:from-blue-200 hover:to-indigo-200 transition-colors shadow-sm"
                    type="button"
                  >
                    <FiBell className="mr-1.5" />
                    {newRequestsCount} new {newRequestsCount === 1 ? 'request' : 'requests'}
                    <FiX className="ml-1.5 h-3 w-3" />
                  </motion.button>
                )}
                
                <motion.button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-1.5 rounded-full text-sm flex items-center transition-colors ${
                    showFilters || activeFiltersCount > 0
                      ? 'bg-blue-100 text-blue-800 shadow-sm' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                >
                  <FiFilter className="mr-1.5 h-4 w-4" /> 
                  Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
                  {showFilters ? <FiChevronUp className="ml-1 h-4 w-4" /> : <FiChevronDown className="ml-1 h-4 w-4" />}
                </motion.button>
                
                {activeFiltersCount > 0 && (
                  <motion.button 
                    onClick={clearFilters}
                    className="px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors flex items-center shadow-sm"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                  >
                    <FiX className="mr-1.5 h-4 w-4" />
                    Clear All
                  </motion.button>
                )}
              </div>
              
              {/* Display counts */}
              <div className="text-sm text-gray-600 hidden md:flex items-center gap-1">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-medium">{totalRequests}</span> 
                <span>total requests</span>
                
              </div>
            </div>
            
            {/* Debugging UI */}
            {capturedRequests.length > 0 && (
              <div className="my-3 p-3 border border-green-200 bg-green-50 rounded-lg">
                <div className="text-sm font-medium text-green-800 mb-2 flex justify-between items-center">
                  <span>Recently Captured WebSocket Requests: {capturedRequests.length}</span>
                  <button 
                    onClick={() => setCapturedRequests([])}
                    className="text-green-700 hover:text-green-900"
                    type="button"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {capturedRequests.map((req, idx) => (
                    <div key={idx} className="text-xs text-green-800 border-t border-green-200 py-1">
                      <span className="font-medium">ID: {req.id}</span> | 
                      Patient: {req.patient_name || req.patient_id} | 
                      Type: {req.test_type} | 
                      Time: {new Date(req.created_at || req.requested_at).toLocaleTimeString()}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Search bar */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base transition-colors shadow-sm"
                placeholder="Search by patient name, ID, or test type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setSearchTerm('')}
                  type="button"
                >
                  <FiX className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            
            {/* Filter area */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border border-gray-200 shadow-inner">
                    {/* Status filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <div className="relative">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="block w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base h-10 transition-colors appearance-none pl-3 pr-10"
                        >
                          <option value="">All Statuses</option>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="canceled">Cancelled</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <FiChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Priority filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <div className="relative">
                        <select
                          value={priorityFilter}
                          onChange={(e) => setPriorityFilter(e.target.value)}
                          className="block w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base h-10 transition-colors appearance-none pl-3 pr-10"
                        >
                          <option value="">All Priorities</option>
                          <option value="ROUTINE">Routine</option>
                          <option value="URGENT">Urgent</option>
                          <option value="EMERGENCY">Emergency</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <FiChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Test type filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                      <div className="relative">
                        <select
                          value={testTypeFilter}
                          onChange={(e) => setTestTypeFilter(e.target.value)}
                          className="block w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base h-10 transition-colors appearance-none pl-3 pr-10"
                        >
                          <option value="">All Test Types</option>
                          <option value="BLOOD">Blood Test</option>
                          <option value="URINE">Urine Test</option>
                          <option value="XRAY">X-Ray</option>
                          <option value="MRI">MRI Scan</option>
                          <option value="CT">CT Scan</option>
                          <option value="ECG">ECG</option>
                          <option value="ULTRASOUND">Ultrasound</option>
                          <option value="complete_blood_count">Complete Blood Count</option>
                          <option value="comprehensive_metabolic_panel">Comprehensive Metabolic Panel</option>
                          <option value="liver_function_test">Liver Function Test</option>
                          <option value="thyroid_panel">Thyroid Panel</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                          <FiChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Date range filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Request Date Range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 sr-only">From</label>
                          <input
                            type="date"
                            value={dateRangeFilter.fromDate}
                            onChange={(e) => setDateRangeFilter(prev => ({ ...prev, fromDate: e.target.value }))}
                            className="block w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base h-10 transition-colors"
                            placeholder="From"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 sr-only">To</label>
                          <input
                            type="date"
                            value={dateRangeFilter.toDate}
                            onChange={(e) => setDateRangeFilter(prev => ({ ...prev, toDate: e.target.value }))}
                            className="block w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-base h-10 transition-colors"
                            placeholder="To"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Lab Requests Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transition-colors">
          {loading && !initialDataLoaded ? (
            <LoadingSkeleton />
          ) : error && !labRequests.length ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="p-3 bg-red-100 rounded-full mb-4">
                <FiAlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
              <p className="text-gray-500 max-w-md mb-6">{error}</p>
              <motion.button 
                onClick={() => fetchLabRequests(true, currentPageRef.current)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
              >
                <FiX className="mr-2 h-4 w-4" />
                Try Again
              </motion.button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test ID</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Type</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading && initialDataLoaded ? (
                      // Show skeleton loaders over existing data during refresh
                      [...Array(5)].map((_, index) => (
                        <TableRowSkeleton key={`skeleton-${index}`} />
                      ))
                    ) : (
                      <AnimatePresence>
                        {filteredRequests.map((request) => (
                          <LabRequestRow 
                            key={request.id}
                            request={request}
                            currentTechnicianId={currentTechnicianId}
                            onViewDetails={fetchRequestDetails}
                            onAssign={assignToSelf}
                            onUpdateStatus={updateRequestStatus}
                            onDeleteRequest={handleDeleteConfirmation}
                            formatDate={formatDate}
                            isNewRequest={newRequestIds.has(request.id)}
                          />
                        ))}
                      </AnimatePresence>
                    )}
                  </tbody>
                </table>
              </div>
              
              {filteredRequests.length === 0 && !loading && (
                <EmptyState 
                  message={
                    activeFiltersCount > 0 || searchTerm 
                      ? "No lab test requests found matching your search or filter criteria."
                      : "No lab test requests are currently available."
                  }
                  onRefresh={clearFilters}
                />
              )}
              
              {/* Pagination - with safe navigation controls */}
              {filteredRequests.length > 0 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{filteredRequests.length}</span> of{' '}
                        <span className="font-medium">{totalRequests}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          onClick={() => !isChangingPage && handlePageChange(Math.max(1, page - 1))}
                          disabled={page === 1 || isChangingPage}
                          className={`relative inline-flex items-center px-3 py-2 rounded-l-md border ${
                            page === 1 || isChangingPage 
                            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                          } transition-colors`}
                          type="button"
                        >
                          <span className="sr-only">Previous</span>
                          <FiChevronLeft className="h-5 w-5" />
                        </button>
                        
                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = page <= 3 
                            ? i + 1
                            : page >= totalPages - 2 
                              ? totalPages - 4 + i
                              : page - 2 + i;
                              
                          if (pageNum <= 0 || pageNum > totalPages) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => !isChangingPage && handlePageChange(pageNum)}
                              disabled={isChangingPage}
                              aria-current={page === pageNum ? 'page' : undefined}
                              className={`relative inline-flex items-center px-4 py-2 border ${
                                isChangingPage
                                ? 'cursor-not-allowed opacity-70'
                                : page === pageNum
                                ? 'z-10 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              } transition-colors`}
                              type="button"
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => !isChangingPage && handlePageChange(Math.min(totalPages, page + 1))}
                          disabled={page === totalPages || totalPages === 0 || isChangingPage}
                          className={`relative inline-flex items-center px-3 py-2 rounded-r-md border ${
                            page === totalPages || totalPages === 0 || isChangingPage
                            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                          } transition-colors`}
                          type="button"
                        >
                          <span className="sr-only">Next</span>
                          <FiChevronRight className="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                  
                  {/* Mobile pagination */}
                  <div className="flex items-center justify-between w-full sm:hidden">
                    <button
                      onClick={() => !isChangingPage && handlePageChange(Math.max(1, page - 1))}
                      disabled={page === 1 || isChangingPage}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                        page === 1 || isChangingPage
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-blue-600 hover:bg-blue-50'
                      }`}
                      type="button"
                    >
                      Previous
                    </button>
                    
                    <span className="text-sm text-gray-700">
                      Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                    </span>
                    
                    <button
                      onClick={() => !isChangingPage && handlePageChange(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages || totalPages === 0 || isChangingPage}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                        page === totalPages || totalPages === 0 || isChangingPage
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-blue-600 hover:bg-blue-50'
                      }`}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Modal */}
        <AnimatePresence>
          {showDetailModal && (
            <DetailModal 
              request={selectedRequest}
              onClose={() => {
                setShowDetailModal(false);
                setIsEditMode(false);
              }}
              onAssign={assignToSelf}
              onUpdateStatus={updateRequestStatus}
              onDelete={handleDeleteConfirmation}
              formatDate={formatDate}
              currentTechnicianId={currentTechnicianId}
              isEditMode={isEditMode}
              editData={editRequestData}
              setEditData={setEditRequestData}
              onSaveChanges={updateLabRequest}
              onToggleEditMode={() => setIsEditMode(!isEditMode)}
            />
          )}
        </AnimatePresence>
        
        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmation.isOpen && (
            <ConfirmationModal
              isOpen={deleteConfirmation.isOpen}
              title="Delete Lab Request"
              message={`Are you sure you want to delete this ${deleteConfirmation.requestType} request? This action cannot be undone.`}
              confirmText="Delete"
              cancelText="Cancel"
              onConfirm={confirmDelete}
              onCancel={cancelDelete}
              type="danger"
            />
          )}
        </AnimatePresence>
      </div>
      
      {/* Settings menu */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-25 z-50 flex justify-end backdrop-blur-sm" onClick={() => setShowSettings(false)}>
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white shadow-lg w-80 max-w-full h-full p-6 overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Settings</h3>
                <motion.button 
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                >
                  <FiX className="h-5 w-5" />
                </motion.button>
              </div>
              
              <div className="space-y-6">
                {/* Notification settings */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Notifications</h4>
                  <div className="space-y-3">
                    <motion.div 
                      className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg shadow-sm border border-gray-200"
                      whileHover={{ y: -2, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                    >
                      <div className="flex items-center">
                        <FiBell className="mr-3 h-5 w-5 text-indigo-400" />
                        <span className="text-sm text-gray-900">
                          Enable Notifications
                        </span>
                      </div>
                      <button 
                        onClick={() => setNotificationsEnabled(prev => !prev)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gray-300'}`}
                        type="button"
                        aria-pressed={notificationsEnabled}
                      >
                        <span 
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} 
                        />
                      </button>
                    </motion.div>
                  </div>
                </div>
                
                {/* WebSocket options */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">WebSocket Connection</h4>
                  <div className="space-y-3">
                    <motion.div
                      className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg shadow-sm border border-gray-200"
                      whileHover={{ y: -2, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-900">Current ID</span>
                        <span className="text-xs font-mono px-2 py-1 rounded-full bg-gray-100 border border-gray-300">
                          {currentTechnicianId.substring(0, 8)}...
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <div className="text-xs text-gray-500 mb-1">Active connections: {wsActiveConnections}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-900">Status</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            wsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {wsStatus}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={wsReconnect}
                          className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs font-medium"
                          type="button"
                        >
                          Force Reconnect
                        </button>
                        
                        <button
                          onClick={simulateLabRequest}
                          className="flex-1 px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs font-medium"
                          type="button"
                        >
                          Test Notification
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </div>
                
                {/* Test sound button */}
                <div className="mt-6">
                  <motion.button
                    onClick={() => {
                      playNotificationSound();
                      notify('Test notification sound played', 'success');
                    }}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                    disabled={!notificationsEnabled}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                  >
                    Test Notification Sound
                  </motion.button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click this button to test notification sounds
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Add CSS for styling */}
      <style jsx>{`
        @tailwind base;
        @tailwind components;
        @tailwind utilities;
        
        :root {
          --primary-color: #5D5CDE;
          --primary-light: #8887FF;
          --primary-dark: #4A49C5;
          --primary-50: #f5f5ff;
          --primary-100: #e4e4ff;
          --primary-200: #cdccff;
          --primary-300: #b0b0ff;
          --primary-400: #9190ff;
          --primary-500: #7675ff;
          --primary-600: #5D5CDE;
          --primary-700: #4A49C5;
          --primary-800: #3f3e99;
          --primary-900: #333380;
        }
        
        html {
          height: 100%;
        }
        
        body {
          min-height: 100%;
        }
                
        /* Accessibility focus styles */
        *:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
        
        /* Pulse animation for new requests */
        @keyframes pulse-light {
          0%, 100% {
            background-color: transparent;
          }
          50% {
            background-color: rgba(209, 250, 229, 0.4);
          }
        }
        
        .animate-pulse-light {
          animation: pulse-light 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          background-color: rgba(236, 253, 245, 0.4);
        }
        
        /* Add support for extra small screens */
        @media (min-width: 480px) {
          .xs\\:flex-row {
            flex-direction: row;
          }
          .xs\\:items-center {
            align-items: center;
          }
          .xs\\:gap-3 {
            gap: 0.75rem;
          }
        }
        
        /* Motion animations */
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        /* Button hover effects */
        .btn-hover-scale {
          transition: transform 0.2s ease;
        }
        
        .btn-hover-scale:hover {
          transform: scale(1.05);
        }
        
        .btn-hover-scale:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
}

export default LabRequestsList;
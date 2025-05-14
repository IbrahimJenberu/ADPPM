import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCalendar, FiClock, FiSearch, FiUser, FiFilter, 
  FiArrowLeft, FiArrowRight, FiChevronDown, FiX, 
  FiCheck, FiAlertCircle, FiInfo
} from 'react-icons/fi';
import { 
  MdOutlineBiotech, MdOutlineTimeline, 
  MdOutlineTrendingUp, MdOutlineInsights 
} from 'react-icons/md';

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  const bgColor = type === 'success' 
    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500' 
    : 'bg-red-50 dark:bg-red-900/30 border-red-500';
  const textColor = type === 'success' 
    ? 'text-emerald-800 dark:text-emerald-200' 
    : 'text-red-800 dark:text-red-200';
  const icon = type === 'success' ? <FiCheck /> : <FiAlertCircle />;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-lg shadow-lg border-l-4 ${bgColor} ${textColor}`}
    >
      <div className="flex-shrink-0 mr-3">{icon}</div>
      <div className="mr-2">{message}</div>
      <button 
        onClick={onClose} 
        className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <FiX />
      </button>
    </motion.div>
  );
};

const LabHistory = () => {
  // View state (lab request history or technician history)
  const [viewMode, setViewMode] = useState('technician'); // 'request' or 'technician'
  
  // Filter states
  const [fromDate, setFromDate] = useState(
    format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd')
  );
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventType, setEventType] = useState('');
  const [requestId, setRequestId] = useState('');
  const [techId, setTechId] = useState(''); // This would typically come from auth context
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Data states
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Toast notification state
  const [toast, setToast] = useState(null);
  
  // Animation refs
  const timelineRef = useRef(null);
  
  // Common event types for filter dropdown
  const eventTypes = [
    { value: '', label: 'All Events' },
    { value: 'CREATED', label: 'Created' },
    { value: 'STATUS_UPDATED', label: 'Status Updated' },
    { value: 'RESULT_UPLOADED', label: 'Results Uploaded' },
    { value: 'PRIORITY_CHANGED', label: 'Priority Changed' },
    { value: 'COMMENT_ADDED', label: 'Comment Added' },
    { value: 'ASSIGNED', label: 'Assigned' }
  ];
  
  // Load technician history
  const fetchTechnicianHistory = async () => {
    if (!techId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`http://localhost:8025/api/history/lab-technician/${techId}`, {
        params: {
          from_date: fromDate,
          to_date: toDate,
          event_type: eventType || undefined,
          page: currentPage,
          page_size: pageSize
        }
      });
      
      if (response.data.success) {
        setEvents(response.data.events);
        setPagination(response.data.pagination);
        if (currentPage > 1 || eventType) {
          showToast('Results updated successfully', 'success');
        }
      } else {
        setError('Failed to load history data');
        showToast('Failed to load history data', 'error');
      }
    } catch (err) {
      const errorMsg = `Error: ${err.response?.data?.detail || err.message}`;
      setError(errorMsg);
      showToast(errorMsg, 'error');
      console.error('Error fetching technician history:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load request history
  const fetchRequestHistory = async () => {
    if (!requestId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`http://localhost:8025/api/history/lab-requests/${requestId}`);
      
      if (response.data.success) {
        setEvents(response.data.events);
        setPagination(null); // No pagination for specific request history
        showToast('Request history loaded successfully', 'success');
      } else {
        setError('Failed to load request history');
        showToast('Failed to load request history', 'error');
      }
    } catch (err) {
      const errorMsg = `Error: ${err.response?.data?.detail || err.message}`;
      setError(errorMsg);
      showToast(errorMsg, 'error');
      console.error('Error fetching request history:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle search/filter submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when filters change
    
    if (viewMode === 'technician') {
      fetchTechnicianHistory();
    } else {
      fetchRequestHistory();
    }
  };
  
  // Change page
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };
  
  // Handle view mode change with animation
  const handleViewModeChange = (mode) => {
    if (mode === viewMode) return;
    
    setViewMode(mode);
    setCurrentPage(1);
    
    // Clear fields that aren't relevant to the new view
    if (mode === 'technician') {
      setRequestId('');
    }
  };
  
  // Show toast notification
  const showToast = (message, type) => {
    setToast({ message, type });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };
  
  // Effect for pagination changes
  useEffect(() => {
    if (viewMode === 'technician' && techId) {
      fetchTechnicianHistory();
    }
  }, [currentPage, pageSize]);
  
  // Initial data load
  useEffect(() => {
    // In a real app, this would come from auth context
    setTechId('3fa85f64-5717-4562-b3fc-2c963f66afa6');
    
    // Set up dark mode
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
    
    // Load initial data
    if (techId) {
      fetchTechnicianHistory();
    }
    
    return () => {
      // Clean up event listener
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', () => {});
    };
  }, []);
  
  // Helper to determine event icon and color
  const getEventStyle = (eventType) => {
    const styles = {
      'CREATED': { 
        icon: <MdOutlineBiotech />, 
        color: 'bg-teal-500 dark:bg-teal-600',
        borderColor: 'border-teal-500 dark:border-teal-600',
        textColor: 'text-teal-700 dark:text-teal-300',
        lightBg: 'bg-teal-50 dark:bg-teal-900/30'
      },
      'STATUS_UPDATED': { 
        icon: <FiClock />, 
        color: 'bg-blue-500 dark:bg-blue-600',
        borderColor: 'border-blue-500 dark:border-blue-600',
        textColor: 'text-blue-700 dark:text-blue-300',
        lightBg: 'bg-blue-50 dark:bg-blue-900/30'
      },
      'RESULT_UPLOADED': { 
        icon: <MdOutlineBiotech />, 
        color: 'bg-purple-500 dark:bg-purple-600',
        borderColor: 'border-purple-500 dark:border-purple-600',
        textColor: 'text-purple-700 dark:text-purple-300',
        lightBg: 'bg-purple-50 dark:bg-purple-900/30'
      },
      'PRIORITY_CHANGED': { 
        icon: <FiFilter />, 
        color: 'bg-amber-500 dark:bg-amber-600',
        borderColor: 'border-amber-500 dark:border-amber-600',
        textColor: 'text-amber-700 dark:text-amber-300',
        lightBg: 'bg-amber-50 dark:bg-amber-900/30'
      },
      'COMMENT_ADDED': { 
        icon: <FiSearch />, 
        color: 'bg-indigo-500 dark:bg-indigo-600',
        borderColor: 'border-indigo-500 dark:border-indigo-600',
        textColor: 'text-indigo-700 dark:text-indigo-300',
        lightBg: 'bg-indigo-50 dark:bg-indigo-900/30'
      },
      'ASSIGNED': { 
        icon: <FiUser />, 
        color: 'bg-emerald-500 dark:bg-emerald-600',
        borderColor: 'border-emerald-500 dark:border-emerald-600',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        lightBg: 'bg-emerald-50 dark:bg-emerald-900/30'
      }
    };
    
    return styles[eventType] || { 
      icon: <MdOutlineTimeline />, 
      color: 'bg-gray-500 dark:bg-gray-600',
      borderColor: 'border-gray-500 dark:border-gray-600',
      textColor: 'text-gray-700 dark:text-gray-300',
      lightBg: 'bg-gray-50 dark:bg-gray-900/30'
    };
  };
  
  // Format event details for display
  const formatEventDetails = (event) => {
    // Extract details based on event type
    if (!event.details) return 'No details available';
    
    // Handle different event types
    switch (event.event_type) {
      case 'STATUS_UPDATED':
        return event.details.old_status && event.details.new_status 
          ? `Status changed from ${event.details.old_status} to ${event.details.new_status}`
          : `Status updated to ${event.details.new_status || event.status}`;
      
      case 'PRIORITY_CHANGED':
        return event.details.old_priority && event.details.new_priority
          ? `Priority changed from ${event.details.old_priority} to ${event.details.new_priority}`
          : 'Priority changed';
          
      case 'COMMENT_ADDED':
        return event.details.comment 
          ? `Comment: "${event.details.comment}"`
          : 'Comment added';
          
      case 'RESULT_UPLOADED':
        return event.details.file_name
          ? `Result uploaded: ${event.details.file_name}`
          : 'Test results uploaded';
      
      case 'ASSIGNED':
        return event.details.assignee_name
          ? `Assigned to ${event.details.assignee_name}`
          : 'Test assigned';
          
      default:
        // For other event types or if structure is unknown
        if (typeof event.details === 'object') {
          // Filter out user_name as it's displayed separately
          const filteredDetails = { ...event.details };
          delete filteredDetails.user_name;
          
          const detailsStr = Object.entries(filteredDetails)
            .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
            .join(', ');
          
          return detailsStr || 'No details available';
        } else if (typeof event.details === 'string') {
          return event.details;
        }
        return 'No details available';
    }
  };
  
  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-gray-800 dark:text-gray-200 transition-colors duration-300">
      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-teal-500 dark:from-indigo-400 dark:to-teal-300 bg-clip-text text-transparent">
                {viewMode === 'technician' ? 'Lab Technician Activity History' : 'Lab Request History'}
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm md:text-base">
                {viewMode === 'technician' 
                  ? 'Track and analyze all actions performed by lab technicians' 
                  : 'View the complete timeline for a specific lab request'}
              </p>
            </div>
            
            {/* View Toggle */}
            <div className="relative z-10 inline-flex rounded-lg p-1.5 bg-gray-100 dark:bg-gray-700/50 shadow-inner self-start">
              <button
                onClick={() => handleViewModeChange('technician')}
                className={`relative px-4 py-2 rounded-md text-sm md:text-base font-medium transition-all duration-200 ease-in-out ${
                  viewMode === 'technician' 
                    ? 'text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-label="Switch to Technician History view"
              >
                {viewMode === 'technician' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-teal-500 to-blue-500 shadow-lg"
                    style={{ borderRadius: '0.375rem' }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <FiUser className="h-4 w-4" />
                  <span>Technician History</span>
                </span>
              </button>
              <button
                onClick={() => handleViewModeChange('request')}
                className={`relative px-4 py-2 rounded-md text-sm md:text-base font-medium transition-all duration-200 ease-in-out ${
                  viewMode === 'request' 
                    ? 'text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                aria-label="Switch to Request History view"
              >
                {viewMode === 'request' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-teal-500 to-blue-500 shadow-lg"
                    style={{ borderRadius: '0.375rem' }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <MdOutlineBiotech className="h-4 w-4" />
                  <span>Request History</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      
        {/* Filters Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <div className="border-b border-gray-100 dark:border-gray-700 px-5 py-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FiFilter className="text-teal-500 dark:text-teal-400" />
              <span>Filter Options</span>
            </h2>
            {/* Add a reset filter button if needed */}
            {(eventType || (viewMode === 'request' && requestId)) && (
              <button 
                onClick={() => {
                  setEventType('');
                  if (viewMode === 'request') setRequestId('');
                  setCurrentPage(1);
                  showToast('Filters have been reset', 'success');
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
                aria-label="Reset filters"
              >
                <FiX className="h-4 w-4" />
                <span>Reset</span>
              </button>
            )}
          </div>
        
          <form onSubmit={handleSubmit} className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <AnimatePresence mode="wait">
                {viewMode === 'request' ? (
                  <motion.div
                    key="request-input"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="lg:col-span-3"
                  >
                    <label htmlFor="request-id" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Lab Request ID
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <MdOutlineBiotech className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="request-id"
                        type="text"
                        value={requestId}
                        onChange={(e) => setRequestId(e.target.value)}
                        placeholder="Enter request UUID for detailed history"
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-400/50 focus:border-teal-500 dark:focus:border-teal-400 outline-none transition-all text-base"
                        required
                        aria-required="true"
                      />
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      key="from-date"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <label htmlFor="from-date" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        From Date
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <FiCalendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="from-date"
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-400/50 focus:border-teal-500 dark:focus:border-teal-400 outline-none transition-all text-base"
                          aria-label="Filter from date"
                        />
                      </div>
                    </motion.div>
                    
                    <motion.div
                      key="to-date"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.05 }}
                    >
                      <label htmlFor="to-date" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        To Date
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <FiCalendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          id="to-date"
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-400/50 focus:border-teal-500 dark:focus:border-teal-400 outline-none transition-all text-base"
                          aria-label="Filter to date"
                        />
                      </div>
                    </motion.div>
                    
                    <motion.div
                      key="event-type"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 }}
                    >
                      <label htmlFor="event-type" className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                        Event Type
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <MdOutlineInsights className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                          <FiChevronDown className="h-5 w-5 text-gray-400" />
                        </div>
                        <select
                          id="event-type"
                          value={eventType}
                          onChange={(e) => setEventType(e.target.value)}
                          className="w-full pl-11 pr-10 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm focus:ring-2 focus:ring-teal-500/50 dark:focus:ring-teal-400/50 focus:border-teal-500 dark:focus:border-teal-400 outline-none transition-all appearance-none text-base"
                          aria-label="Filter by event type"
                        >
                          {eventTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </motion.div>
                  </>
                )}
                
                <motion.div 
                  key="search-button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.15 }}
                  className="flex items-end"
                >
                  <button
                    type="submit"
                    disabled={loading || (viewMode === 'request' && !requestId)}
                    className="w-full h-[54px] bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 focus:ring-4 focus:ring-teal-500/50 dark:focus:ring-teal-400/50 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    aria-label="Apply filters and search"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing
                      </>
                    ) : (
                      <>
                        <FiSearch className="h-5 w-5" />
                        Search
                      </>
                    )}
                  </button>
                </motion.div>
              </AnimatePresence>
            </div>
          </form>
        </motion.div>
        
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg shadow-sm flex items-start"
              role="alert"
            >
              <FiAlertCircle className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Error Loading Data</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)} 
                className="ml-auto text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 flex-shrink-0"
                aria-label="Dismiss error"
              >
                <FiX className="h-5 w-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Timeline */}
        <motion.div 
          ref={timelineRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MdOutlineTimeline className="text-blue-500 dark:text-blue-400" />
              <span>Activity Timeline</span>
            </h2>
            
            {viewMode === 'technician' && pagination && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {events.length} of {pagination.total} records
              </div>
            )}
          </div>
          
          <div className="relative">
            {loading ? (
              <div className="flex flex-col justify-center items-center p-16">
                <div className="w-16 h-16 relative">
                  <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                  <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-teal-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading activity data...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col justify-center items-center p-16">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <MdOutlineTimeline className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Records Found</h3>
                <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                  {viewMode === 'technician' 
                    ? 'No activity records found for the selected time period and filters.' 
                    : 'No history found for the specified request ID. Please verify and try again.'}
                </p>
              </div>
            ) : (
              <div className="px-4 md:px-6 py-6 relative">
                {/* Timeline line */}
                <div className="absolute top-8 bottom-0 left-8 md:left-10 w-0.5 bg-gradient-to-b from-blue-500/80 via-teal-500/80 to-indigo-500/80 dark:from-blue-400/60 dark:via-teal-400/60 dark:to-indigo-400/60"></div>
                
                {/* Events */}
                <div className="space-y-8">
                  {events.map((event, index) => {
                    const { icon, color, borderColor, textColor, lightBg } = getEventStyle(event.event_type);
                    const formattedDate = event.event_timestamp 
                      ? format(parseISO(event.event_timestamp), 'MMM d, yyyy h:mm a')
                      : 'Unknown date';
                    
                    return (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        className="relative flex items-start group"
                      >
                        {/* Event Icon */}
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                          className={`flex items-center justify-center w-16 h-16 rounded-full ${color} text-white z-10 shadow-lg shrink-0`}
                        >
                          <span className="text-2xl">{icon}</span>
                        </motion.div>
                        
                        {/* Event Content */}
                        <div className="ml-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-5 flex-grow transform transition-transform duration-300 hover:translate-y-[-2px] hover:shadow-lg">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                            <div>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${lightBg} ${textColor} mb-2`}>
                                {event.event_type.replace(/_/g, ' ')}
                              </span>
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {event.test_type || 'Lab Activity'}
                              </h3>
                            </div>
                            <time className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5" dateTime={event.event_timestamp}>
                              <FiClock className="h-3.5 w-3.5" />
                              {formattedDate}
                            </time>
                          </div>
                          
                          {/* Event Details */}
                          <div className="mt-3 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                            {formatEventDetails(event)}
                          </div>
                          
                          {/* User who performed the action */}
                          {(event.details?.user_name || event.user_name) && (
                            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 flex items-center">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 mr-2">
                                <FiUser className="h-3.5 w-3.5" />
                              </div>
                              <span>By: {event.details?.user_name || event.user_name}</span>
                            </div>
                          )}
                          
                          {/* Lab Request ID when in technician view */}
                          {viewMode === 'technician' && event.lab_request_id && (
                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                <MdOutlineBiotech className="h-4 w-4" />
                                <span>Request ID: {event.lab_request_id.slice(0, 8)}...</span>
                              </span>
                              <motion.button 
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors"
                                onClick={() => {
                                  setRequestId(event.lab_request_id);
                                  setViewMode('request');
                                }}
                                aria-label={`View history for request ${event.lab_request_id}`}
                              >
                                <FiSearch className="h-4 w-4" />
                                View Request History
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Pagination for technician view */}
          {viewMode === 'technician' && pagination && !loading && events.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="sm:hidden flex-1 flex justify-between">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                  }`}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === pagination.total_pages}
                  className={`ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md transition-colors ${
                    currentPage === pagination.total_pages
                      ? 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                  }`}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <span>Showing</span>
                    <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span>
                    <span>to</span>
                    <span className="font-medium">
                      {Math.min(currentPage * pageSize, pagination.total)}
                    </span>
                    <span>of</span>
                    <span className="font-medium">{pagination.total}</span>
                    <span>results</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <motion.button
                      whileHover={{ backgroundColor: currentPage !== 1 ? '#f9fafb' : undefined }}
                      whileTap={{ scale: currentPage !== 1 ? 0.97 : 1 }}
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium ${
                        currentPage === 1
                          ? 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700 cursor-not-allowed'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                      }`}
                      aria-label="Previous page"
                    >
                      <span className="sr-only">Previous</span>
                      <FiArrowLeft className="h-5 w-5" />
                    </motion.button>
                    
                    {/* Page number buttons - show at most 5 pages */}
                    {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                      // If fewer than 5 pages, show all
                      let pageNum;
                      if (pagination.total_pages <= 5) {
                        pageNum = i + 1;
                      }
                      // If current page is near the beginning
                      else if (currentPage <= 3) {
                        pageNum = i + 1;
                      }
                      // If current page is near the end
                      else if (currentPage >= pagination.total_pages - 2) {
                        pageNum = pagination.total_pages - 4 + i;
                      }
                      // If current page is in the middle
                      else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      // Don't show invalid page numbers
                      if (pageNum <= 0 || pageNum > pagination.total_pages) return null;
                      
                      return (
                        <motion.button
                          key={pageNum}
                          whileHover={{ backgroundColor: currentPage !== pageNum ? '#f9fafb' : undefined }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handlePageChange(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-gradient-to-r from-teal-500 to-blue-500 border-teal-500 text-white'
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                          }`}
                          aria-label={`Page ${pageNum}`}
                          aria-current={currentPage === pageNum ? "page" : undefined}
                        >
                          {pageNum}
                        </motion.button>
                      );
                    })}
                    
                    <motion.button
                      whileHover={{ backgroundColor: currentPage !== pagination.total_pages ? '#f9fafb' : undefined }}
                      whileTap={{ scale: currentPage !== pagination.total_pages ? 0.97 : 1 }}
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === pagination.total_pages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium ${
                        currentPage === pagination.total_pages
                          ? 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700 cursor-not-allowed'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                      }`}
                      aria-label="Next page"
                    >
                      <span className="sr-only">Next</span>
                      <FiArrowRight className="h-5 w-5" />
                    </motion.button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      
      {/* Add Tailwind Configuration */}
      <script src="https://cdn.tailwindcss.com"></script>
      <script dangerouslySetInnerHTML={{
        __html: `
          tailwind.config = {
            darkMode: 'class',
            theme: {
              extend: {
                fontFamily: {
                  sans: ['Inter', 'system-ui', 'sans-serif'],
                },
                colors: {
                  primary: '#5D5CDE',
                },
                boxShadow: {
                  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
                },
                animation: {
                  'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                },
                transitionProperty: {
                  'height': 'height',
                  'spacing': 'margin, padding',
                }
              }
            }
          }
        `
      }} />
      
      {/* Set up dark mode listener */}
      <script dangerouslySetInnerHTML={{
        __html: `
          // Check for dark mode preference
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
          }
          
          // Listen for changes
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (event.matches) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          });
        `
      }} />
    </div>
  );
};

export default LabHistory;
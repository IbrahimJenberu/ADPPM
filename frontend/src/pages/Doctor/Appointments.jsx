import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiChevronLeft, FiChevronRight, FiEdit2, FiX, FiCheck, 
  FiFilter, FiSearch, FiCalendar, FiClock, FiUser,
  FiClipboard, FiRefreshCw, FiAlertCircle, FiCheckCircle,
  FiInfo, FiSlash, FiActivity, FiMenu, FiSettings, FiArrowUp
} from 'react-icons/fi';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { Toaster, toast } from 'react-hot-toast';

export default function DoctorAppointments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [dateRange, setDateRange] = useState({
    from: new Date(),
    to: new Date(new Date().setDate(new Date().getDate() + 30))
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 10
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [scrolled, setScrolled] = useState(false);
  
  // Refs for modal focus management
  const modalRef = useRef(null);
  const initialFocusRef = useRef(null);
  const returnFocusRef = useRef(null);
  // Create a single refs object for appointment action buttons
  const appointmentButtonRefs = useRef({});
  const headerRef = useRef(null);
  
  // Status options for dropdown
  const statusOptions = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

  // Scroll to top handler
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check scroll position for floating button
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [dateRange, statusFilter, pagination.skip, pagination.limit, user?.id]);

  useEffect(() => {
    // Reset pagination when search query changes
    setCurrentPage(1);
    
    // Filter appointments based on search query
    if (searchQuery.trim() === '') {
      setFilteredAppointments(appointments);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = appointments.filter(appointment => 
        appointment.patient_name.toLowerCase().includes(query) ||
        appointment.reason?.toLowerCase().includes(query) ||
        appointment.notes?.toLowerCase().includes(query) ||
        appointment.status.toLowerCase().includes(query) ||
        appointment.appointment_type.toLowerCase().includes(query)
      );
      setFilteredAppointments(filtered);
    }
  }, [searchQuery, appointments]);

  // Auto-dismiss success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  
  // Focus trap for modal
  useEffect(() => {
    if (showUpdateModal && modalRef.current) {
      // Set focus to the first focusable element
      if (initialFocusRef.current) {
        initialFocusRef.current.focus();
      }
      
      // Setup Escape key to close modal
      const handleEscKey = (event) => {
        if (event.key === 'Escape') {
          setShowUpdateModal(false);
        }
      };
      
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [showUpdateModal]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      // Format dates for API
      const fromDate = dateRange.from.toISOString().split('T')[0];
      const toDate = dateRange.to.toISOString().split('T')[0];
      
      const params = new URLSearchParams({
        date_from: fromDate,
        date_to: toDate,
        skip: pagination.skip,
        limit: pagination.limit,
        doctor_id: user?.id,
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      const response = await axios.get(`http://localhost:8024/appointments/?${params.toString()}`);
      
      if (response.data.success) {
        setAppointments(response.data.appointments);
        setFilteredAppointments(response.data.appointments);
        setTotalAppointments(response.data.total);
      } else {
        setError('Failed to fetch appointments');
        toast.error('Failed to fetch appointments', {
          duration: 4000,
          icon: '⚠️'
        });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to fetch appointments';
      setError(errorMessage);
      toast.error(errorMessage, {
        duration: 4000,
        icon: '⚠️'
      });
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateAppointment = async () => {
    if (!selectedAppointment) return;
    
    // Use the selected status if changed, otherwise use the current status
    const statusToUpdate = selectedStatus || selectedAppointment.status;
    
    try {
      toast.loading('Updating appointment...', { id: 'appointmentUpdate' });
      
      const response = await axios.patch(`http://localhost:8024/appointments/${selectedAppointment.id}`, {
        status: statusToUpdate,
        notes: updateNotes
      });
      
      if (response.data.success) {
        // Update local state with the updated appointment
        const updatedAppointments = appointments.map(apt => 
          apt.id === selectedAppointment.id ? response.data.appointment : apt
        );
        
        setAppointments(updatedAppointments);
        setFilteredAppointments(updatedAppointments); // Update filtered appointments too
        setShowUpdateModal(false);
        setSelectedAppointment(null);
        setSelectedStatus('');
        setUpdateNotes('');
        setSuccess(response.data.message || 'Appointment updated successfully');
        
        toast.success('Appointment updated successfully', { id: 'appointmentUpdate' });
        
        // Return focus to the element that opened the modal
        if (returnFocusRef.current) {
          returnFocusRef.current.focus();
        }
      } else {
        setError('Failed to update appointment');
        toast.error('Failed to update appointment', { id: 'appointmentUpdate' });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to update appointment';
      setError(errorMessage);
      toast.error(errorMessage, { id: 'appointmentUpdate' });
      console.error('Error updating appointment:', err);
    }
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).format(date);
  };
  
  const formatDateTime = (dateTimeStr) => {
    const date = new Date(dateTimeStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  
  const formatTime = (dateTimeStr) => {
    const date = new Date(dateTimeStr);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  
  const formatShortDate = (dateTimeStr) => {
    const date = new Date(dateTimeStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };
  
  const handleDateFromChange = (e) => {
    setDateRange({
      ...dateRange,
      from: new Date(e.target.value)
    });
  };
  
  const handleDateToChange = (e) => {
    setDateRange({
      ...dateRange,
      to: new Date(e.target.value)
    });
  };
  
  const openUpdateModal = (appointment, appointmentId) => {
    // Save reference to the button that opened the modal
    returnFocusRef.current = appointmentButtonRefs.current[appointmentId] || null;
    
    setSelectedAppointment(appointment);
    setSelectedStatus(appointment.status);
    setUpdateNotes(appointment.notes || '');
    setShowUpdateModal(true);
  };
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'SCHEDULED':
        return {
          bg: 'bg-indigo-50',
          text: 'text-indigo-800',
          border: 'border-indigo-200',
          icon: <FiClock className="w-4 h-4 mr-1.5 text-indigo-500" />,
          dot: 'bg-indigo-500',
          gradientFrom: 'from-indigo-400',
          gradientTo: 'to-blue-500'
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-primary-50',
          text: 'text-primary-800',
          border: 'border-primary-200',
          icon: <FiCheck className="w-4 h-4 mr-1.5 text-primary-500" />,
          dot: 'bg-primary-500',
          gradientFrom: 'from-blue-400',
          gradientTo: 'to-cyan-400'
        };
      case 'COMPLETED':
        return {
          bg: 'bg-teal-50',
          text: 'text-teal-800',
          border: 'border-teal-200',
          icon: <FiCheckCircle className="w-4 h-4 mr-1.5 text-teal-500" />,
          dot: 'bg-teal-500',
          gradientFrom: 'from-teal-400',
          gradientTo: 'to-emerald-500'
        };
      case 'CANCELLED':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-800',
          border: 'border-rose-200',
          icon: <FiX className="w-4 h-4 mr-1.5 text-rose-500" />,
          dot: 'bg-rose-500',
          gradientFrom: 'from-rose-400',
          gradientTo: 'to-pink-500'
        };
      case 'NO_SHOW':
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-800',
          border: 'border-slate-200',
          icon: <FiSlash className="w-4 h-4 mr-1.5 text-slate-500" />,
          dot: 'bg-slate-500',
          gradientFrom: 'from-slate-400',
          gradientTo: 'to-gray-500'
        };
      default:
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-800',
          border: 'border-slate-200',
          icon: <FiClock className="w-4 h-4 mr-1.5 text-slate-500" />,
          dot: 'bg-slate-500',
          gradientFrom: 'from-slate-400',
          gradientTo: 'to-gray-500'
        };
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    
    // Only update server-side pagination if not searching
    if (!searchQuery) {
      const newSkip = (page - 1) * pagination.limit;
      setPagination({ ...pagination, skip: newSkip });
    }
  };
  
  // Get paginated results for the current view
  const getPaginatedResults = () => {
    if (searchQuery) {
      // Client-side pagination for search results
      const startIndex = (currentPage - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      return filteredAppointments.slice(startIndex, endIndex);
    } else {
      // For non-search results, we're already paginating server-side
      return filteredAppointments;
    }
  };
  
  // Calculate total pages
  const totalPages = searchQuery 
    ? Math.ceil(filteredAppointments.length / pagination.limit)
    : Math.ceil(totalAppointments / pagination.limit);
  
  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5; // Show a max of 5 page numbers
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total pages is less than or equal to maxPagesToShow
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate start and end of middle pages
      let startPage = Math.max(2, currentPage - Math.floor((maxPagesToShow - 3) / 2));
      let endPage = startPage + (maxPagesToShow - 4);
      
      // Adjust if we're near the end
      if (endPage >= totalPages) {
        endPage = totalPages - 1;
        startPage = Math.max(2, endPage - (maxPagesToShow - 4));
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  const displayedAppointments = getPaginatedResults();
  
  // Check if a date is today
  const isToday = (dateString) => {
    const today = new Date();
    const date = new Date(dateString);
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };
  
  // Check if a date is in the past
  const isPast = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    return date < now;
  };
  
  // Appointment skeleton loading component
  const AppointmentSkeleton = () => (
    <div className="rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40 shadow-xl shadow-slate-200/40 dark:shadow-slate-900/30 backdrop-blur-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700/40">
        <div className="flex items-center">
          <div className="rounded-full bg-slate-200/70 dark:bg-slate-700/70 h-12 w-12 animate-pulse"></div>
          <div className="ml-4">
            <div className="h-5 bg-slate-200/70 dark:bg-slate-700/70 rounded-md w-40 animate-pulse"></div>
            <div className="mt-2 h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-md w-28 animate-pulse"></div>
          </div>
          <div className="ml-auto">
            <div className="h-7 bg-slate-200/70 dark:bg-slate-700/70 rounded-full w-24 animate-pulse"></div>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center mb-4">
          <div className="h-5 bg-slate-200/70 dark:bg-slate-700/70 rounded-md w-44 animate-pulse"></div>
        </div>
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-md w-full mb-3 animate-pulse"></div>
        <div className="h-4 bg-slate-200/70 dark:bg-slate-700/70 rounded-md w-4/5 animate-pulse"></div>
        <div className="mt-6 flex justify-end">
          <div className="h-9 bg-slate-200/70 dark:bg-slate-700/70 rounded-lg w-28 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
  
  // Variants for animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };
  
  const modalVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    },
    exit: { 
      opacity: 0, 
      y: 30, 
      scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const tableRowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i) => ({ 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: i * 0.05,
        duration: 0.3,
        ease: [0.4, 0.0, 0.2, 1]
      }
    })
  };

  // Animation variants for cards
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({ 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: i * 0.05,
        duration: 0.5,
        ease: [0.4, 0.0, 0.2, 1]
      }
    }),
    hover: { 
      y: -5, 
      boxShadow: "0 15px 30px rgba(0, 0, 0, 0.1)",
      transition: { duration: 0.3, ease: "easeOut" } 
    }
  };
  
  return (
    <div className="space-y-6 font-['Inter'] relative min-h-screen pb-24">
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-4 backdrop-blur-sm',
          duration: 5000,
          style: {
            background: 'var(--toast-bg, rgba(255, 255, 255, 0.9))',
            color: 'var(--toast-color, #1e293b)',
            backdropFilter: 'blur(8px)'
          },
          success: {
            style: {
              '--toast-bg': 'rgba(236, 253, 245, 0.95)',
              '--toast-color': '#065f46',
              borderColor: 'rgba(167, 243, 208, 0.5)'
            },
            iconTheme: {
              primary: '#10b981',
              secondary: 'white',
            },
          },
          error: {
            style: {
              '--toast-bg': 'rgba(254, 242, 242, 0.95)',
              '--toast-color': '#991b1b',
              borderColor: 'rgba(254, 202, 202, 0.5)'
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: 'white',
            },
          },
        }}
      />

      {/* Premium Header Card */}
      <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 dark:from-blue-600 dark:via-indigo-600 dark:to-violet-600 rounded-2xl shadow-xl overflow-hidden">
        <div className="relative px-6 py-8 md:px-8 md:py-12">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 font-['Satoshi'] tracking-tight">
                  Patient Appointments
                </h1>
                <p className="text-blue-100 max-w-lg">
                  Manage your upcoming appointments, review patient details, and track appointment status.
                </p>
              </div>
              
              <div className="mt-6 md:mt-0 flex flex-wrap gap-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-xl bg-white/15 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm focus:ring-2 focus:ring-white/50 focus:outline-none transition-all duration-200"
                  onClick={() => {
                    setCurrentPage(1);
                    setPagination({ ...pagination, skip: 0 });
                    fetchAppointments();
                  }}
                >
                  <FiRefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </motion.button>
                
                <div className="inline-flex rounded-xl shadow-sm backdrop-blur-sm overflow-hidden border border-white/20" role="group">
                  <motion.button
                    whileHover={{ backgroundColor: viewMode === 'list' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)' }}
                    whileTap={{ scale: 0.97 }}
                    className={`px-5 py-2.5 text-sm font-medium ${
                      viewMode === 'list'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/90'
                    } focus:z-10 focus:ring-2 focus:ring-white/50 focus:outline-none transition-all duration-200`}
                    onClick={() => setViewMode('list')}
                  >
                    <span className="flex items-center">
                      <FiClipboard className="mr-2 h-4 w-4" />
                      List
                    </span>
                  </motion.button>
                  <motion.button
                    whileHover={{ backgroundColor: viewMode === 'calendar' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)' }}
                    whileTap={{ scale: 0.97 }}
                    className={`px-5 py-2.5 text-sm font-medium ${
                      viewMode === 'calendar'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/90'
                    } focus:z-10 focus:ring-2 focus:ring-white/50 focus:outline-none transition-all duration-200`}
                    onClick={() => setViewMode('calendar')}
                  >
                    <span className="flex items-center">
                      <FiCalendar className="mr-2 h-4 w-4" />
                      Cards
                    </span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Card */}
      <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/30 border border-slate-200/60 dark:border-slate-700/40 backdrop-blur-sm overflow-hidden">
        <div ref={headerRef} className="p-6 border-b border-slate-100 dark:border-slate-700/40">
          {/* Success message with enhanced styling */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border border-teal-200/70 dark:border-teal-700/30 text-teal-800 dark:text-teal-100 px-5 py-4 rounded-xl mb-6 flex justify-between items-center shadow-sm shadow-teal-100/50 dark:shadow-teal-900/10"
              >
                <div className="flex items-center">
                  <div className="bg-teal-100 dark:bg-teal-700/50 p-1.5 rounded-full flex-shrink-0 mr-3">
                    <FiCheck className="w-5 h-5 text-teal-600 dark:text-teal-300" />
                  </div>
                  <p className="font-medium">{success}</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(20, 184, 166, 0.15)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSuccess('')} 
                  className="text-teal-700 dark:text-teal-300 hover:bg-teal-100/50 dark:hover:bg-teal-800/40 p-1.5 rounded-full transition-colors duration-200"
                  aria-label="Dismiss message"
                >
                  <FiX size={18} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Error state with enhanced styling */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -15, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -5, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 border border-rose-200/70 dark:border-rose-700/30 text-rose-800 dark:text-rose-100 px-5 py-4 rounded-xl mb-6 flex justify-between items-center shadow-sm shadow-rose-100/50 dark:shadow-rose-900/10"
              >
                <div className="flex items-center">
                  <div className="bg-rose-100 dark:bg-rose-700/50 p-1.5 rounded-full flex-shrink-0 mr-3">
                    <FiAlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-300" />
                  </div>
                  <div>
                    <p className="font-medium">{error}</p>
                    <p className="text-sm text-rose-600 dark:text-rose-300/80 mt-1">
                      Please try again or contact support if the issue persists.
                    </p>
                  </div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(225, 29, 72, 0.15)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setError(null)} 
                  className="text-rose-700 dark:text-rose-300 hover:bg-rose-100/50 dark:hover:bg-rose-800/40 p-1.5 rounded-full transition-colors duration-200"
                  aria-label="Dismiss error"
                >
                  <FiX size={18} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Enhanced Filters and Search */}
          <div className="mb-6 bg-slate-50/50 dark:bg-slate-800/20 backdrop-blur-sm rounded-xl border border-slate-200/60 dark:border-slate-700/40 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-4 md:p-5 bg-gradient-to-r from-slate-50 to-slate-100/70 dark:from-slate-800/40 dark:to-slate-700/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-1.5 bg-indigo-100/60 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-300 mr-3">
                    <FiFilter className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Appointment Filters</h3>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                >
                  {isFilterExpanded ? (
                    <>
                      <span>Collapse</span>
                      <FiChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Expand</span>
                      <FiChevronRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
              
              <AnimatePresence>
                {isFilterExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="pt-5"
                  >
                    <div className="flex flex-col md:flex-row gap-5">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date Range</label>
                        <div className="flex gap-3 flex-col sm:flex-row sm:items-center">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <FiCalendar className="text-slate-500 dark:text-slate-400" />
                            </div>
                            <input 
                              type="date" 
                              className="pl-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 px-4 py-2.5 text-base text-slate-700 dark:text-slate-200 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30 transition-all duration-200"
                              value={dateRange.from.toISOString().split('T')[0]}
                              onChange={handleDateFromChange}
                            />
                          </div>
                          <span className="hidden sm:block text-slate-500 dark:text-slate-400">to</span>
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <FiCalendar className="text-slate-500 dark:text-slate-400" />
                            </div>
                            <input 
                              type="date" 
                              className="pl-10 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 px-4 py-2.5 text-base text-slate-700 dark:text-slate-200 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30 transition-all duration-200"
                              value={dateRange.to.toISOString().split('T')[0]}
                              onChange={handleDateToChange}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="md:w-64">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Appointment Status</label>
                        <div className="relative">
                          <select 
                            className="appearance-none w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 px-4 py-2.5 text-base text-slate-700 dark:text-slate-200 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30 transition-all duration-200 pr-10"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            <option value="">All Statuses</option>
                            {statusOptions.map(status => (
                              <option key={status} value={status}>{status.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500 dark:text-slate-400">
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="self-end">
                        <motion.button 
                          whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(79, 70, 229, 0.15)" }}
                          whileTap={{ scale: 0.98 }}
                          className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-medium rounded-xl shadow-md hover:shadow-lg shadow-indigo-100 dark:shadow-none transition-all duration-200 w-full sm:w-auto justify-center"
                          onClick={() => {
                            setCurrentPage(1);
                            setPagination({ ...pagination, skip: 0 });
                            fetchAppointments();
                          }}
                        >
                          <FiFilter className="mr-2" />
                          Apply Filters
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Enhanced Search Bar */}
            <div className="p-4 md:p-5 bg-white dark:bg-slate-800/60 border-t border-slate-200/60 dark:border-slate-700/40">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiSearch className="text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search appointments by patient name, reason, notes, etc."
                  className="pl-11 pr-4 py-3 w-full rounded-xl bg-slate-50/70 dark:bg-slate-700/40 border border-slate-200/70 dark:border-slate-600/40 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 transition-all duration-200 shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400 transition-colors duration-200"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Loading state with enhanced skeletons */}
        {loading && (
          <div className="px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <AppointmentSkeleton key={i} />
              ))}
            </div>
          </div>
        )}
        
        {/* Premium Appointments List View */}
        {!loading && !error && viewMode === 'list' && (
          <div className="px-6 pb-6">
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-700/40 shadow-lg shadow-slate-200/20 dark:shadow-slate-900/20"
            >
              <div className="min-w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/40">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100/60 dark:from-slate-800/60 dark:to-slate-700/30">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Patient
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Notes
                      </th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800/60 divide-y divide-slate-200/60 dark:divide-slate-700/40">
                    {displayedAppointments.map((appointment, index) => {
                      const statusColor = getStatusColor(appointment.status);
                      const isAppointmentToday = isToday(appointment.appointment_datetime);
                      const isAppointmentPast = isPast(appointment.appointment_datetime);
                      
                      return (
                        <motion.tr 
                          key={appointment.id} 
                          custom={index}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          whileHover={{ backgroundColor: 'rgba(241, 245, 249, 0.5)', dark: { backgroundColor: 'rgba(30, 41, 59, 0.5)' } }}
                          className={`transition-colors duration-150 ${
                            isAppointmentToday ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-11 w-11 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/50 dark:border-blue-700/30 flex items-center justify-center text-indigo-500 dark:text-indigo-300 shadow-sm">
                                <FiUser className="h-5 w-5" />
                              </div>
                              <div className="ml-4">
                                <div className="text-base font-medium text-slate-800 dark:text-slate-200">{appointment.patient_name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  ID: {appointment.patient_id.substring(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`text-sm font-medium ${
                              isAppointmentPast ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {formatDateTime(appointment.appointment_datetime)}
                              {isAppointmentToday && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/30">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center">
                              <FiClock className="mr-1 h-3 w-3" />
                              Duration: {appointment.duration_minutes} min
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-700/70 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-600/40 shadow-sm">
                              {appointment.appointment_type.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r ${statusColor.gradientFrom} ${statusColor.gradientTo} text-white border border-white/10 shadow-sm`}>
                              {statusColor.icon}
                              {appointment.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate">
                              {appointment.notes || (
                                <span className="text-slate-400 dark:text-slate-500 italic">No notes available</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <motion.button 
                              ref={el => appointmentButtonRefs.current[appointment.id] = el}
                              onClick={() => openUpdateModal(appointment, appointment.id)} 
                              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-colors duration-200 border border-indigo-100 dark:border-indigo-700/30 shadow-sm"
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              aria-label={`Update appointment for ${appointment.patient_name}`}
                            >
                              <FiEdit2 className="h-4 w-4 mr-1.5" /> 
                              Update
                            </motion.button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Premium Card View with 3D effects and animations */}
        {!loading && !error && viewMode === 'calendar' && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedAppointments.map((appointment, index) => {
                const statusColor = getStatusColor(appointment.status);
                const isAppointmentToday = isToday(appointment.appointment_datetime);
                
                return (
                  <motion.div 
                    key={appointment.id}
                    custom={index}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover="hover"
                    className={`rounded-2xl bg-white dark:bg-slate-800/60 border ${
                      isAppointmentToday 
                        ? 'border-indigo-200 dark:border-indigo-800/40 shadow-lg shadow-indigo-100/30 dark:shadow-indigo-900/20' 
                        : 'border-slate-200/60 dark:border-slate-700/40 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/20'
                    } backdrop-blur-sm overflow-hidden group`}
                  >
                    <div className="p-5 border-b border-slate-100 dark:border-slate-700/40 flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/50 dark:border-blue-700/30 flex items-center justify-center text-indigo-500 dark:text-indigo-300 shadow-sm group-hover:scale-110 transition-transform duration-300">
                          <FiUser className="h-6 w-6" />
                        </div>
                        <div className="ml-4">
                          <div className="text-base font-medium text-slate-800 dark:text-slate-200">{appointment.patient_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            ID: {appointment.patient_id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r ${statusColor.gradientFrom} ${statusColor.gradientTo} text-white border border-white/10 shadow-sm`}>
                        {statusColor.icon}
                        {appointment.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="p-5">
                      <div className="flex flex-wrap items-center mb-4 gap-y-2 gap-x-4">
                        <div className="flex items-center text-slate-800 dark:text-slate-200 font-medium">
                          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mr-2 border border-blue-100 dark:border-blue-800/30">
                            <FiCalendar className="h-4 w-4 text-blue-500 dark:text-blue-300" />
                          </div>
                          <span>{formatShortDate(appointment.appointment_datetime)}</span>
                        </div>
                        
                        <div className="flex items-center text-slate-800 dark:text-slate-200 font-medium">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mr-2 border border-indigo-100 dark:border-indigo-800/30">
                            <FiClock className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                          </div>
                          <span>{formatTime(appointment.appointment_datetime)}</span>
                        </div>
                        
                        <div className="flex items-center text-slate-600 dark:text-slate-300">
                          <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center mr-2 border border-slate-100 dark:border-slate-600/30">
                            <FiActivity className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          </div>
                          <span className="text-sm">{appointment.duration_minutes} min</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700/70 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-600/40 shadow-sm">
                          {appointment.appointment_type.replace('_', ' ')}
                        </span>
                        {isAppointmentToday && (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/30">
                            <FiInfo className="mr-1 h-3.5 w-3.5" />
                            Today
                          </span>
                        )}
                      </div>
                      
                      <div className="bg-slate-50/80 dark:bg-slate-700/30 rounded-xl p-4 mb-5 border border-slate-200/60 dark:border-slate-600/30">
                        <h4 className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider mb-2">Notes</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {appointment.notes || (
                            <span className="text-slate-400 dark:text-slate-500 italic">No notes available</span>
                          )}
                        </p>
                      </div>
                      
                      <div className="flex justify-end">
                        <motion.button 
                          ref={el => appointmentButtonRefs.current[appointment.id] = el}
                          onClick={() => openUpdateModal(appointment, appointment.id)} 
                          className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white shadow-md hover:shadow-lg shadow-indigo-100/30 dark:shadow-indigo-900/20 transition-all duration-200 font-medium text-sm"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          aria-label={`Update appointment for ${appointment.patient_name}`}
                        >
                          <FiEdit2 className="h-4 w-4 mr-1.5" /> 
                          Update Appointment
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Enhanced No appointments state */}
        {!loading && !error && displayedAppointments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-800 dark:to-blue-900/30 flex items-center justify-center mb-6 border border-slate-200/60 dark:border-slate-700/40 shadow-lg shadow-slate-200/20 dark:shadow-slate-900/20">
              <FiCalendar className="h-10 w-10 text-blue-400 dark:text-blue-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">No appointments found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center max-w-md mb-8">
              {searchQuery ? 'No appointments match your search criteria. Try adjusting your filters or search terms.' : 'There are no appointments scheduled for the selected time period.'}
            </p>
            <motion.button 
              whileHover={{ scale: 1.03, boxShadow: "0 8px 20px rgba(79, 70, 229, 0.15)" }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-medium rounded-xl shadow-md hover:shadow-lg shadow-indigo-100/30 dark:shadow-indigo-900/20 transition-all duration-200"
              onClick={() => {
                setStatusFilter('');
                setSearchQuery('');
                setDateRange({
                  from: new Date(),
                  to: new Date(new Date().setDate(new Date().getDate() + 30))
                });
                setCurrentPage(1);
                setPagination({ ...pagination, skip: 0 });
                fetchAppointments();
              }}
            >
              <FiRefreshCw className="mr-2 h-4 w-4" />
              Reset & View All Appointments
            </motion.button>
          </div>
        )}
        
        {/* Premium Pagination UI */}
        {!loading && !error && totalPages > 1 && (
          <div className="border-t border-slate-200/60 dark:border-slate-700/40 px-6 py-5">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-slate-500 dark:text-slate-400 order-2 sm:order-1">
                {searchQuery ? (
                  `Showing ${(currentPage - 1) * pagination.limit + 1} to ${Math.min(currentPage * pagination.limit, filteredAppointments.length)} of ${filteredAppointments.length} results`
                ) : (
                  `Showing ${pagination.skip + 1} to ${Math.min(pagination.skip + pagination.limit, totalAppointments)} of ${totalAppointments} appointments`
                )}
              </div>
              
              <div className="flex items-center gap-1.5 order-1 sm:order-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600/70 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/50 transition-all duration-200 shadow-sm"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <FiChevronLeft size={18} />
                </motion.button>
                
                <div className="flex items-center gap-1.5">
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 py-1 text-slate-500 dark:text-slate-400">
                        <svg width="16" height="4" viewBox="0 0 16 4" fill="none">
                          <circle cx="2" cy="2" r="2" fill="currentColor" />
                          <circle cx="8" cy="2" r="2" fill="currentColor" />
                          <circle cx="14" cy="2" r="2" fill="currentColor" />
                        </svg>
                      </span>
                    ) : (
                      <motion.button
                        key={page}
                        whileHover={currentPage !== page ? { scale: 1.05 } : {}}
                        whileTap={currentPage !== page ? { scale: 0.95 } : {}}
                        className={`w-10 h-10 rounded-lg ${
                          currentPage === page
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-100/50 dark:shadow-indigo-900/30'
                            : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600/70 shadow-sm'
                        } focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/50 transition-all duration-200 font-medium`}
                        onClick={() => handlePageChange(page)}
                        aria-label={`Page ${page}`}
                        aria-current={currentPage === page ? 'page' : undefined}
                      >
                        {page}
                      </motion.button>
                    )
                  ))}
                </div>
                
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600/70 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/50 transition-all duration-200 shadow-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  aria-label="Next page"
                >
                  <FiChevronRight size={18} />
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scroll to top button */}
      <AnimatePresence>
        {scrolled && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 p-3 rounded-full bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/30 z-50"
            aria-label="Scroll to top"
          >
            <FiArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Premium Update Appointment Modal with improved accessibility */}
      <AnimatePresence>
        {showUpdateModal && selectedAppointment && (
          <div className="fixed inset-0 z-50 overflow-y-auto font-['Inter']" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="flex min-h-screen items-center justify-center p-4 text-center">
              {/* Premium Backdrop with blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setShowUpdateModal(false)}
                aria-hidden="true"
              />
              
              {/* Premium Modal with enhanced styling */}
              <motion.div
                ref={modalRef}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-md transform rounded-2xl bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-700/10 border border-indigo-100/60 dark:border-indigo-800/40 relative overflow-hidden"
              >
                {/* Decorative elements */}
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-indigo-100/40 to-blue-100/30 dark:from-indigo-900/30 dark:to-blue-900/20 blur-xl"></div>
                <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-100/40 to-blue-100/30 dark:from-indigo-900/30 dark:to-blue-900/20 blur-xl"></div>
                
                <div className="relative z-10">
                  <motion.button 
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 p-2 rounded-full hover:bg-indigo-100/50 dark:hover:bg-indigo-800/30 transition-colors duration-200"
                    onClick={() => setShowUpdateModal(false)}
                    aria-label="Close modal"
                  >
                    <FiX size={20} />
                  </motion.button>
                  
                  <h3 
                    className="text-2xl font-bold text-slate-800 dark:text-white mb-5 font-['Satoshi'] tracking-tight" 
                    id="modal-title"
                  >
                    Update Appointment
                  </h3>
                  
                  <div className="mb-6">
                    <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-800/60 dark:to-indigo-900/20 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/40 shadow-sm mb-5">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/50 dark:border-blue-700/30 flex items-center justify-center text-indigo-500 dark:text-indigo-300 shadow-sm">
                          <FiUser className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Patient</div>
                          <div className="text-base font-semibold text-slate-800 dark:text-slate-200">{selectedAppointment.patient_name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            ID: {selectedAppointment.patient_id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Date & Time</div>
                          <div className="flex items-center text-sm text-slate-800 dark:text-slate-200 font-medium">
                            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mr-2 border border-blue-100 dark:border-blue-800/30">
                              <FiCalendar className="h-3.5 w-3.5 text-blue-500 dark:text-blue-300" />
                            </div>
                            {formatDateTime(selectedAppointment.appointment_datetime)}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Duration</div>
                          <div className="flex items-center text-sm text-slate-800 dark:text-slate-200 font-medium">
                            <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mr-2 border border-indigo-100 dark:border-indigo-800/30">
                              <FiClock className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
                            </div>
                            {selectedAppointment.duration_minutes} minutes
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Current Status</div>
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r ${getStatusColor(selectedAppointment.status).gradientFrom} ${getStatusColor(selectedAppointment.status).gradientTo} text-white border border-white/10 shadow-sm`}>
                            {getStatusColor(selectedAppointment.status).icon}
                            {selectedAppointment.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Update Status</label>
                      <div className="grid grid-cols-2 gap-3">
                        {statusOptions.map(status => {
                          const statusStyle = getStatusColor(status);
                          return (
                            <motion.button 
                              key={status}
                              type="button"
                              ref={selectedStatus === status ? initialFocusRef : null}
                              className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                                selectedStatus === status 
                                  ? `bg-gradient-to-r ${statusStyle.gradientFrom} ${statusStyle.gradientTo} text-white shadow-md shadow-${statusStyle.dot.split('-')[1]}-200/30 dark:shadow-${statusStyle.dot.split('-')[1]}-900/30 border-0` 
                                  : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600/70'
                              }`}
                              onClick={() => setSelectedStatus(status)}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              aria-pressed={selectedStatus === status}
                            >
                              <div className="flex items-center justify-center">
                                {getStatusColor(status).icon}
                                {status.replace('_', ' ')}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label 
                        htmlFor="update-notes" 
                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                      >
                        Notes
                      </label>
                      <textarea 
                        id="update-notes"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 px-4 py-3 text-base text-slate-700 dark:text-slate-200 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:focus:ring-indigo-400/30 transition-all duration-200 shadow-sm"
                        rows="3"
                        value={updateNotes}
                        onChange={(e) => setUpdateNotes(e.target.value)}
                        placeholder="Add notes about this appointment..."
                      ></textarea>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-400/50 transition-all duration-200 font-medium shadow-sm"
                      onClick={() => setShowUpdateModal(false)}
                    >
                      Cancel
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02, boxShadow: "0 8px 20px rgba(79, 70, 229, 0.15)" }}
                      whileTap={{ scale: 0.98 }}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white rounded-xl shadow-md hover:shadow-lg shadow-indigo-100/30 dark:shadow-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-all duration-200 font-medium"
                      onClick={updateAppointment}
                    >
                      <FiCheck className="inline mr-1.5" /> Update Appointment
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
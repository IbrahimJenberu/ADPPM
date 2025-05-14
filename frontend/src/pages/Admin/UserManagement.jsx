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

function UserManagement() {
  // ===== STATE & AUTH =====
  const { authClient } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [highlightedUserId, setHighlightedUserId] = useState(null);
  const [recentlyAddedUsers, setRecentlyAddedUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 10,
    total: 0,
    pages: 1
  });
  
  // Analytics state
  const [activeTab, setActiveTab] = useState('management');
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
  
  // Form state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    department: 'Pulmonology',
    role: 'user',
    is_active: true,
    is_verified: false
  });
  const [formErrors, setFormErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Refs
  const modalRef = useRef(null);
  const nameInputRef = useRef(null);
  const formRef = useRef(null);
  const autoRefreshTimerRef = useRef(null);
  const refreshButtonRef = useRef(null);
  
  // ===== LIFECYCLE HOOKS =====
  // Fetch users and apply filters
  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const response = await authClient.get('/users', {
        params: {
          skip: (page - 1) * pagination.size,
          limit: pagination.size,
          role: roleFilter !== 'all' ? roleFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }
      });
      
      setUsers(response.data.items);
      setPagination({
        page,
        size: response.data.size,
        total: response.data.total,
        pages: response.data.pages
      });
    } catch (error) {
      showToast('Failed to fetch users: ' + (error.response?.data?.detail || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Analytics fetch functions
  const fetchAnalyticsSummary = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const response = await authClient.get('/analytics/summary');
      setAnalyticsSummary(response.data);
      setLastRefreshTime(new Date());
      if (refreshButtonRef.current) {
        refreshButtonRef.current.classList.add('animate-wiggle');
        setTimeout(() => {
          if (refreshButtonRef.current) {
            refreshButtonRef.current.classList.remove('animate-wiggle');
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
      setAnalyticsError('Failed to fetch route analytics: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch route analytics', 'error');
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
      setAnalyticsError('Failed to fetch popular routes: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch popular routes', 'error');
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

  const fetchHistoryData = useCallback(async (filters = {}, showLoadingState = true) => {
    try {
      if (showLoadingState) setAnalyticsLoading(true);
      const params = {
        limit: filters.limit || 100,
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.route && { route: filters.route }),
        ...(filters.start_time && { start_time: filters.start_time.toISOString() }),
        ...(filters.end_time && { end_time: filters.end_time.toISOString() })
      };
      
      const response = await authClient.get('/analytics/history', { params });
      setHistoryData(response.data);
      setLastRefreshTime(new Date());
    } catch (error) {
      setAnalyticsError('Failed to fetch history data: ' + (error.response?.data?.detail || error.message));
      showToast('Failed to fetch history data', 'error');
    } finally {
      if (showLoadingState) setAnalyticsLoading(false);
    }
  }, [authClient]);

  // Auto refresh function
  const refreshAnalyticsData = useCallback(() => {
    // Only refresh data for the current tab
    if (activeTab !== 'analytics') return;
    
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
      fetchHistoryData(historyFilters, false);
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
    activeTab, 
    analyticsSubTab, 
    analyticsTimePeriod, 
    selectedUserId, 
    historyFilters, 
    fetchAnalyticsSummary, 
    fetchPopularRoutes, 
    fetchTimeBasedStats, 
    fetchRouteAnalytics, 
    fetchUserAnalytics, 
    fetchHistoryData
  ]);

  // Load user data on component mount
  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  // Load analytics data when tab changes to analytics
  useEffect(() => {
    if (activeTab === 'analytics') {
      // Load different data based on the sub-tab
      if (analyticsSubTab === 'dashboard') {
        fetchAnalyticsSummary();
        fetchPopularRoutes();
        fetchTimeBasedStats(analyticsTimePeriod);
      } else if (analyticsSubTab === 'routes') {
        fetchRouteAnalytics();
        fetchPopularRoutes();
      } else if (analyticsSubTab === 'history') {
        fetchHistoryData(historyFilters);
      } else if (analyticsSubTab === 'reports') {
        fetchAnalyticsSummary();
        fetchRouteAnalytics();
        fetchTimeBasedStats(analyticsTimePeriod);
      }
    }
  }, [activeTab, analyticsSubTab, fetchAnalyticsSummary, fetchPopularRoutes, fetchTimeBasedStats, fetchRouteAnalytics, fetchHistoryData, analyticsTimePeriod, historyFilters]);

  // Refresh time-based stats when period changes
  useEffect(() => {
    if (activeTab === 'analytics' && 
        (analyticsSubTab === 'dashboard' || analyticsSubTab === 'reports')) {
      fetchTimeBasedStats(analyticsTimePeriod);
    }
  }, [analyticsTimePeriod, activeTab, analyticsSubTab, fetchTimeBasedStats]);

  // Fetch user-specific analytics when a user is selected
  useEffect(() => {
    if (selectedUserId) {
      fetchUserAnalytics(selectedUserId);
    }
  }, [selectedUserId, fetchUserAnalytics]);

  // Fetch history data when history filters change
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsSubTab === 'history') {
      fetchHistoryData(historyFilters);
    }
  }, [activeTab, analyticsSubTab, historyFilters, fetchHistoryData]);

  // Set up auto-refresh timer
  useEffect(() => {
    if (autoRefreshEnabled && activeTab === 'analytics') {
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
  }, [autoRefreshEnabled, autoRefreshInterval, activeTab, refreshAnalyticsData]);

  // Filter users based on search term
  useEffect(() => {
    if (!users) return;
    
    const filtered = users.filter(user => {
      const matchesSearch = !searchTerm || 
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
    
    setFilteredUsers(filtered);
  }, [users, searchTerm]);

  // Focus on name input when modal opens
  useEffect(() => {
    if (showModal && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current.focus();
      }, 100);
    }
  }, [showModal]);

  // Handle outside clicks for modal
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target) && showModal) {
        // Only close if we clicked outside the modal
        setShowModal(false);
      }
    }
    
    // Add event listener only when the modal is shown
    if (showModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModal]);

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
      className: type === 'success' ? 'bg-green-50 text-green-800 border-l-4 border-green-500' : 
                 type === 'error' ? 'bg-red-50 text-red-800 border-l-4 border-red-500' : 
                 'bg-blue-50 text-blue-800 border-l-4 border-blue-500',
    });
  };
  
  // Open modal for adding a new user
  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      id: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      department: 'Pulmonology',
      role: 'user',
      is_active: true,
      is_verified: false
    });
    setFormErrors({});
    setTouchedFields({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setCurrentUser(null);
    
    // Important: Set modal to show after all other state updates
    setShowModal(true);
  };
  
  // Open modal for editing an existing user
  const openEditModal = (user) => {
    setModalMode('edit');
    setCurrentUser(user);
    setFormData({
      id: user.id,
      username: user.username || '',
      email: user.email || '',
      password: '',
      confirmPassword: '',
      full_name: user.full_name || '',
      department: user.department || 'Pulmonology',
      role: user.role || 'user',
      is_active: user.is_active,
      is_verified: user.is_verified
    });
    setFormErrors({});
    setTouchedFields({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowModal(true);
  };
  
  // Close the modal
  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setTimeout(() => {
      setCurrentUser(null);
      setFormData({
        id: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        department: 'Pulmonology',
        role: 'user',
        is_active: true,
        is_verified: false
      });
      setFormErrors({});
      setTouchedFields({});
    }, 300);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Mark field as touched
    setTouchedFields(prev => ({
      ...prev,
      [name]: true
    }));
    
    // Validate field on change
    validateField(name, newValue);
    
    // Special validation for confirm password when password changes
    if (name === 'password' && formData.confirmPassword) {
      validateField('confirmPassword', formData.confirmPassword, newValue);
    }
  };
  
  // Field blur handler for validation
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouchedFields(prev => ({
      ...prev,
      [name]: true
    }));
    validateField(name, formData[name]);
  };
  
  // Validate a single form field
  const validateField = (fieldName, value, password = formData.password) => {
    let error = '';
    
    switch (fieldName) {
      case 'full_name':
        if (!value.trim()) {
          error = 'Full name is required';
        } else if (value.trim().length < 3) {
          error = 'Name must be at least 3 characters';
        }
        break;
        
      case 'email':
        if (!value.trim()) {
          error = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;
        
      case 'username':
        if (!value.trim()) {
          error = 'Username is required';
        } else if (value.trim().length < 3) {
          error = 'Username must be at least 3 characters';
        }
        break;
        
      case 'password':
        if (modalMode === 'add') {
          if (!value) {
            error = 'Password is required';
          } else if (value.length < 8) {
            error = 'Password must be at least 8 characters';
          } else if (!/[A-Z]/.test(value)) {
            error = 'Include an uppercase letter';
          } else if (!/[a-z]/.test(value)) {
            error = 'Include a lowercase letter';
          } else if (!/[0-9]/.test(value)) {
            error = 'Include a number';
          } else if (!/[^A-Za-z0-9]/.test(value)) {
            error = 'Include a special character';
          }
        }
        break;
        
      case 'confirmPassword':
        if (modalMode === 'add') {
          if (!value) {
            error = 'Please confirm your password';
          } else if (value !== password) {
            error = 'Passwords do not match';
          }
        }
        break;
        
      default:
        break;
    }
    
    setFormErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
    
    return !error;
  };
  
  // Validate the entire form
  const validateForm = () => {
    const requiredFields = modalMode === 'add' 
      ? ['full_name', 'email', 'username', 'password', 'confirmPassword'] 
      : ['full_name'];
    
    let isValid = true;
    
    // Mark all fields as touched
    const newTouchedFields = {};
    requiredFields.forEach(field => {
      newTouchedFields[field] = true;
    });
    setTouchedFields(prev => ({
      ...prev,
      ...newTouchedFields
    }));
    
    // Validate each required field
    requiredFields.forEach(field => {
      const fieldValue = formData[field];
      const fieldValid = validateField(
        field, 
        fieldValue, 
        field === 'confirmPassword' ? formData.password : undefined
      );
      if (!fieldValid) {
        isValid = false;
      }
    });
    
    return isValid;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      showToast("Please correct the form errors", "error");
      return;
    }
    
    setSubmitting(true);
    
    try {
      if (modalMode === 'add') {
        // Create new user
        const response = await authClient.post('/users', {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          department: formData.department,
          role: formData.role,
          is_active: formData.is_active
        });
        
        showToast(
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <p className="font-medium">User added successfully!</p>
              <p className="text-sm">User <span className="font-semibold">{formData.full_name}</span> has been created.</p>
            </div>
          </div>, 
          "success"
        );
        
        // Update user list
        await fetchUsers(pagination.page);
        
        // Highlight the new user and add to recently added list
        const newUserId = response.data?.id || users.find(u => u.email === formData.email)?.id;
        if (newUserId) {
          setHighlightedUserId(newUserId);
          setRecentlyAddedUsers(prev => [...prev, newUserId]);
          
          // Remove highlight after 5 seconds, but keep in recently added for 24 hours
          setTimeout(() => setHighlightedUserId(null), 5000);
          setTimeout(() => {
            setRecentlyAddedUsers(prev => prev.filter(id => id !== newUserId));
          }, 24 * 60 * 60 * 1000); // 24 hours
        }
      } else {
        // Update existing user with all editable fields
        await authClient.put(`/users/${currentUser.id}`, {
          full_name: formData.full_name,
          email: formData.email,
          username: formData.username,
          department: formData.department,
          role: formData.role,
          is_active: formData.is_active,
          is_verified: formData.is_verified
        });
        
        showToast(
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <p className="font-medium">User updated successfully!</p>
              <p className="text-sm">User <span className="font-semibold">{formData.full_name}</span> has been updated.</p>
            </div>
          </div>, 
          "success"
        );
        
        // Update user list
        await fetchUsers(pagination.page);
        
        // Highlight the updated user
        setHighlightedUserId(currentUser.id);
        // Remove highlight after 5 seconds
        setTimeout(() => setHighlightedUserId(null), 5000);
      }
      
      closeModal();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || "An error occurred";
      showToast(
        <div className="flex items-center">
          <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm">{errorMsg}</p>
          </div>
        </div>, 
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle user delete
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        setLoading(true);
        await authClient.delete(`/users/${userId}`);
        showToast(
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="font-medium">User deleted successfully</span>
          </div>,
          "success"
        );
        fetchUsers(pagination.page);
      } catch (error) {
        const errorMsg = error.response?.data?.detail || error.message || "An error occurred";
        showToast(`Error deleting user: ${errorMsg}`, "error");
      } finally {
        setLoading(false);
      }
    }
  };
  
  // Handle user status toggle
  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await authClient.put(`/users/${userId}`, {
        is_active: newStatus
      });
      showToast(
        <div className="flex items-center">
          <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span className="font-medium">User {newStatus ? 'activated' : 'deactivated'} successfully</span>
        </div>,
        "success"
      );
      fetchUsers(pagination.page);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || "An error occurred";
      showToast(`Error updating status: ${errorMsg}`, "error");
    }
  };
  
  // Prevent form submission on Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };
  
  // View user analytics
  const handleViewUserAnalytics = (userId) => {
    setSelectedUserId(userId);
    setActiveTab('analytics');
    setAnalyticsSubTab('dashboard');
  };
  
  // Update history filters
  const handleHistoryFilterChange = (name, value) => {
    setHistoryFilters(prev => ({
      ...prev,
      [name]: value
    }));
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
  // Calculate password strength (0-100)
  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length
    if (password.length >= 8) strength += 25;
    
    // Character types
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^A-Za-z0-9]/.test(password)) strength += 10;
    
    return Math.min(100, strength);
  };
  
  // Get password strength label
  const getPasswordStrengthLabel = (strength) => {
    if (strength < 40) return 'Weak';
    if (strength < 70) return 'Fair';
    if (strength < 90) return 'Good';
    return 'Strong';
  };
  
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
  
  // Get time since registration
  const getTimeSinceRegistered = (dateString) => {
    if (!dateString) return '';
    
    const now = new Date();
    const registered = new Date(dateString);
    const diffMs = now - registered;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 24 * 60) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / (60 * 24))}d ago`;
    }
  };
  
  // Get role badge styling - Updated with distinct colors for each role
  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'manager':
        return 'bg-blue-100 text-blue-700';
      case 'doctor':
        return 'bg-indigo-100 text-indigo-700';
      case 'cardroom':
        return 'bg-amber-100 text-amber-700';
      case 'labroom':
        return 'bg-sky-100 text-sky-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };
  
  // Get status badge styling
  const getStatusBadgeStyle = (status) => {
    return status
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-gray-100 text-gray-600';
  };
  
  // Get method badge styling
  const getMethodBadgeStyle = (method) => {
    switch (method?.toUpperCase()) {
      case 'GET':
        return 'bg-blue-100 text-blue-700';
      case 'POST':
        return 'bg-green-100 text-green-700';
      case 'PUT':
        return 'bg-amber-100 text-amber-700';
      case 'DELETE':
        return 'bg-red-100 text-red-700';
      case 'PATCH':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };
  
  const passwordStrength = calculatePasswordStrength(formData.password);

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
    if (value === undefined || value === null) return 'text-gray-500';
    
    // For metrics where lower is better (like bounce rate), use inverse
    if (inverse) {
      return value <= benchmark ? 'text-green-600' : 'text-red-600';
    }
    
    // For metrics where higher is better
    return value >= benchmark ? 'text-green-600' : 'text-red-600';
  };
  
  // Process time-based data for charts
  const processTimeData = (data) => {
    if (!data || !data.time_data) return { labels: [], datasets: [] };
    
    const labels = data.time_data.map(item => item.period);
    const datasets = [
      {
        label: 'Visitors',
        data: data.time_data.map(item => item.visitors),
        borderColor: 'rgba(79, 70, 229, 1)',
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Page Views',
        data: data.time_data.map(item => item.pageviews),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.0)',
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
    
    const labels = topRoutes.map(route => {
      // Shorten route name if too long
      const path = route.route || route.path || '/';
      return path.length > 25 ? path.substring(0, 22) + '...' : path;
    });
    
    const data = topRoutes.map(route => route.count || route.visits || 0);
    
    // Generate colors
    const backgroundColors = [
      'rgba(79, 70, 229, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(99, 102, 241, 0.8)',
      'rgba(236, 72, 153, 0.8)'
    ];
    
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          borderWidth: 1,
          borderColor: '#ffffff'
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
        backgroundColor: 'rgba(79, 70, 229, 0.8)',
        borderColor: 'rgba(79, 70, 229, 1)',
        borderWidth: 1
      }
    ];
    
    return { labels, datasets };
  };

  // Skeleton loader component
  const SkeletonLoader = () => (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-gray-200 rounded-lg mb-6"></div>
      
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex items-center space-x-4 py-3 border-b border-gray-100">
          <div className="rounded-full bg-gray-200 h-12 w-12"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="w-24 h-6 bg-gray-200 rounded-full"></div>
          <div className="w-20 h-8 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  );

  // Analytics skeleton loader
  const AnalyticsSkeletonLoader = () => (
    <div className="animate-pulse space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-gray-200 rounded-xl h-32"></div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-200 rounded-xl h-80"></div>
        <div className="bg-gray-200 rounded-xl h-80"></div>
      </div>
      
      {/* Table */}
      <div className="bg-gray-200 rounded-xl h-64"></div>
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

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl shadow-sm p-6 space-y-6">
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
            {activeTab === 'management' ? 'User Management' : 'Analytics Dashboard'}
          </h1>
          <p className="text-gray-500 mt-1">
            {activeTab === 'management' 
              ? 'Manage user accounts, roles, and permissions' 
              : 'Track system usage, performance, and user activity'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab toggle buttons */}
          <div className="bg-gray-100 rounded-lg p-1 flex items-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('management')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'management' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Management
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === 'analytics' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Analytics
            </motion.button>
          </div>
          
          {/* Action button (visible only in management view) */}
          {activeTab === 'management' && (
            <motion.button
              onClick={openAddModal}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm flex items-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-50 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>Add New User</span>
            </motion.button>
          )}
        </div>
      </div>
      
      {/* Management View */}
      <AnimatePresence mode="wait">
        {activeTab === 'management' && (
          <motion.div
            key="management"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Filters Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-5">
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Search Input */}
                  <div className="relative flex-grow">
                    <label htmlFor="searchInput" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Search
                    </label>
                    <div className="relative">
                      <input
                        id="searchInput"
                        type="text"
                        className="block w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
                        placeholder="Search by name, email, or username"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      {searchTerm && (
                        <button 
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                          onClick={() => setSearchTerm('')}
                          type="button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Role Filter */}
                    <div className="min-w-[180px]">
                      <label htmlFor="roleFilter" className="block text-xs font-medium text-gray-700 mb-1.5">
                        Role
                      </label>
                      <select
                        id="roleFilter"
                        className="block w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                      >
                        <option value="all">All Roles</option>
                        <option value="admin">Administrator</option>
                        <option value="doctor">Doctor</option>
                        <option value="cardroom">Card Room</option>
                        <option value="labroom">Lab Technician</option>
                        <option value="user">Regular User</option>
                      </select>
                    </div>
                    
                    {/* Status Filter */}
                    <div className="min-w-[180px]">
                      <label htmlFor="statusFilter" className="block text-xs font-medium text-gray-700 mb-1.5">
                        Status
                      </label>
                      <select
                        id="statusFilter"
                        className="block w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Active Filters */}
                {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 py-1">Active filters:</div>
                    
                    {searchTerm && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Search: {searchTerm}
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="ml-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                          type="button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {roleFilter !== 'all' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Role: {roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}
                        <button 
                          onClick={() => setRoleFilter('all')}
                          className="ml-1.5 text-indigo-600 hover:text-indigo-800 transition-colors"
                          type="button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {statusFilter !== 'all' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                        <button 
                          onClick={() => setStatusFilter('all')}
                          className="ml-1.5 text-emerald-600 hover:text-emerald-800 transition-colors"
                          type="button"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </span>
                    )}
                    
                    {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setRoleFilter('all');
                          setStatusFilter('all');
                        }}
                        className="text-xs text-gray-600 hover:text-gray-900 font-medium px-2 py-1 hover:bg-gray-50 rounded-md transition-colors ml-2"
                        type="button"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? (
                <div className="p-6">
                  <SkeletonLoader />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                  <div className="bg-gray-100 rounded-full p-4 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No users found</h3>
                  <p className="text-gray-500 max-w-md mb-6">
                    {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                      ? "Try adjusting your search or filter criteria to find what you\'re looking for."
                      : 'Start by adding your first user to the system.'}
                  </p>
                  {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setSearchTerm('');
                        setRoleFilter('all');
                        setStatusFilter('all');
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                      type="button"
                    >
                      Clear all filters
                    </motion.button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Last Login
                        </th>
                        <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredUsers.map((user) => {
                        const isHighlighted = highlightedUserId === user.id;
                        const isRecentlyAdded = recentlyAddedUsers.includes(user.id);
                        
                        return (
                          <motion.tr 
                            key={user.id} 
                            initial={isHighlighted ? { backgroundColor: 'rgba(79, 70, 229, 0.1)' } : {}}
                            animate={isHighlighted ? 
                              { backgroundColor: ['rgba(79, 70, 229, 0.1)', 'rgba(79, 70, 229, 0.05)', 'rgba(79, 70, 229, 0.1)'] } : 
                              { backgroundColor: 'transparent' }
                            }
                            transition={{ duration: 2, repeat: 2 }}
                            className={`hover:bg-gray-50 transition-colors ${isRecentlyAdded ? 'bg-indigo-50/30' : ''}`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-11 w-11 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm flex items-center justify-center">
                                  <span className="font-medium text-sm">
                                    {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900 flex items-center">
                                    {user.full_name || 'Unnamed User'}
                                    
                                    {/* Badge for recently added users */}
                                    {isRecentlyAdded && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                        </svg>
                                        New
                                      </span>
                                    )}
                                    
                                    {/* Badge for highlighted users (temporary) */}
                                    {isHighlighted && !isRecentlyAdded && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 animate-pulse">
                                        Updated
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.username}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.department || 'Not assigned'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeStyle(user.role)}`}>
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeStyle(user.is_active)}`}>
                                {user.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(user.last_login)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex justify-end space-x-2">
                                
                                
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => openEditModal(user)}
                                  className="text-indigo-600 hover:text-indigo-900 transition-colors p-1.5 hover:bg-indigo-50 rounded-full"
                                  title="Edit user"
                                  type="button"
                                  aria-label="Edit user"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleToggleStatus(user.id, user.is_active)}
                                  className={`${
                                    user.is_active 
                                      ? 'text-amber-600 hover:text-amber-900 hover:bg-amber-50' 
                                      : 'text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50'
                                  } transition-colors p-1.5 rounded-full`}
                                  title={user.is_active ? 'Deactivate user' : 'Activate user'}
                                  type="button"
                                  aria-label={user.is_active ? 'Deactivate user' : 'Activate user'}
                                >
                                  {user.is_active ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="text-red-600 hover:text-red-900 transition-colors p-1.5 hover:bg-red-50 rounded-full"
                                  title="Delete user"
                                  type="button"
                                  aria-label="Delete user"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </motion.button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Pagination */}
            {!loading && pagination.pages > 1 && (
              <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-100">
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(pagination.page - 1) * pagination.size + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(pagination.page * pagination.size, pagination.total)}</span> of{' '}
                      <span className="font-medium">{pagination.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => fetchUsers(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        type="button"
                        aria-label="Previous page"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </motion.button>
                      
                      {/* Show page numbers */}
                      {[...Array(pagination.pages)].map((_, i) => (
                        <motion.button
                          key={i}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => fetchUsers(i + 1)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pagination.page === i + 1
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          type="button"
                          aria-label={`Page ${i + 1}`}
                          aria-current={pagination.page === i + 1 ? 'page' : undefined}
                        >
                          {i + 1}
                        </motion.button>
                      ))}
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => fetchUsers(pagination.page + 1)}
                        disabled={pagination.page === pagination.pages}
                        className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
      
        {/* Analytics View */}
        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Analytics Tabs + Auto Refresh Controls */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex overflow-x-auto">
                  <button
                    onClick={() => setAnalyticsSubTab('dashboard')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                      analyticsSubTab === 'dashboard'
                        ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50 bg-opacity-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    } transition-colors focus:outline-none`}
                    aria-current={analyticsSubTab === 'dashboard' ? 'page' : undefined}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setAnalyticsSubTab('routes')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                      analyticsSubTab === 'routes'
                        ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50 bg-opacity-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    } transition-colors focus:outline-none`}
                    aria-current={analyticsSubTab === 'routes' ? 'page' : undefined}
                  >
                    Routes
                  </button>
                  <button
                    onClick={() => setAnalyticsSubTab('history')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                      analyticsSubTab === 'history'
                        ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50 bg-opacity-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    } transition-colors focus:outline-none`}
                    aria-current={analyticsSubTab === 'history' ? 'page' : undefined}
                  >
                    History
                  </button>
                  <button
                    onClick={() => setAnalyticsSubTab('reports')}
                    className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
                      analyticsSubTab === 'reports'
                        ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50 bg-opacity-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    } transition-colors focus:outline-none`}
                    aria-current={analyticsSubTab === 'reports' ? 'page' : undefined}
                  >
                    Reports
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button 
                      ref={refreshButtonRef}
                      onClick={refreshAnalyticsData}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                      disabled={analyticsLoading}
                      aria-label="Refresh data"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${analyticsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <div className="text-xs text-gray-500">
                      Updated: {getTimeSinceRefresh()}
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-1 flex items-center">
                    <button
                      onClick={() => changeAutoRefreshInterval(5)}
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        autoRefreshEnabled && autoRefreshInterval === 5
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      aria-pressed={autoRefreshEnabled && autoRefreshInterval === 5}
                    >
                      5s
                    </button>
                    <button
                      onClick={() => changeAutoRefreshInterval(15)}
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        autoRefreshEnabled && autoRefreshInterval === 15
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      aria-pressed={autoRefreshEnabled && autoRefreshInterval === 15}
                    >
                      15s
                    </button>
                    <button
                      onClick={() => changeAutoRefreshInterval(30)}
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        autoRefreshEnabled && autoRefreshInterval === 30
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      aria-pressed={autoRefreshEnabled && autoRefreshInterval === 30}
                    >
                      30s
                    </button>
                    <button
                      onClick={() => changeAutoRefreshInterval(60)}
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        autoRefreshEnabled && autoRefreshInterval === 60
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
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
                      <div className={`relative w-11 h-6 ${autoRefreshEnabled ? 'bg-indigo-600' : 'bg-gray-200'} rounded-full peer peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                      <span className="ml-2 text-sm font-medium text-gray-900">Auto-refresh</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Analytics Tools Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-5">
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Time period selector */}
                  <div className="min-w-[200px]">
                    <label htmlFor="timePeriod" className="block text-xs font-medium text-gray-700 mb-1.5">
                      Time Period
                    </label>
                    <select
                      id="timePeriod"
                      className="block w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
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
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">
                        Selected User
                      </label>
                      <div className="flex items-center">
                        <div className="bg-indigo-100 text-indigo-800 rounded-lg px-3 py-2 font-medium text-sm flex-grow">
                          {users.find(u => u.id === selectedUserId)?.full_name || selectedUserId}
                        </div>
                        <button
                          onClick={() => setSelectedUserId(null)}
                          className="ml-2 text-gray-500 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
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
                        <label htmlFor="historyRoute" className="block text-xs font-medium text-gray-700 mb-1.5">
                          Route Path
                        </label>
                        <input
                          id="historyRoute"
                          type="text"
                          className="block w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
                          placeholder="/api/users"
                          value={historyFilters.route}
                          onChange={(e) => handleHistoryFilterChange('route', e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="historyLimit" className="block text-xs font-medium text-gray-700 mb-1.5">
                          Results Limit
                        </label>
                        <select
                          id="historyLimit"
                          className="block w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
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
                        <label htmlFor="historyStartDate" className="block text-xs font-medium text-gray-700 mb-1.5">
                          Start Date
                        </label>
                        <input
                          id="historyStartDate"
                          type="date"
                          className="block w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
                          value={historyFilters.start_time ? new Date(historyFilters.start_time).toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : null;
                            handleHistoryFilterChange('start_time', date);
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor="historyEndDate" className="block text-xs font-medium text-gray-700 mb-1.5">
                          End Date
                        </label>
                        <input
                          id="historyEndDate"
                          type="date"
                          className="block w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-lg shadow-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all duration-200 text-base"
                          value={historyFilters.end_time ? new Date(historyFilters.end_time).toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            const date = e.target.value ? new Date(e.target.value) : null;
                            handleHistoryFilterChange('end_time', date);
                          }}
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          onClick={clearHistoryFilters}
                          className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                          type="button"
                        >
                          Clear Filters
                        </button>
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
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      {analyticsError}
                    </p>
                    <p className="mt-2 text-sm text-red-700">
                      Please check your connection and try again later.
                    </p>
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <h2 className="text-xl font-bold text-gray-900">
                                User Activity Analysis
                              </h2>
                              <p className="text-gray-500 mt-1">
                                Detailed analytics for {users.find(u => u.id === selectedUserId)?.full_name || 'user'} over time
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">Last updated:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {formatDate(userAnalytics?.last_updated || new Date().toISOString())}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* User Stats Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {/* Total Logins */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-blue-50 text-blue-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Total Logins</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {formatNumber(userAnalytics?.total_logins || 0)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className={`text-sm ${userAnalytics?.login_change?.positive ? 'text-green-600' : 'text-red-600'}`}>
                                  {userAnalytics?.login_change?.positive ? '↑' : '↓'} {userAnalytics?.login_change?.value || 0}%
                                </span>
                                <span className="text-sm text-gray-500 ml-1">vs. previous {analyticsTimePeriod}</span>
                              </div>
                            </div>
                          </motion.div>
                          
                          {/* Active Days */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-indigo-50 text-indigo-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Active Days</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {userAnalytics?.active_days || 0}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className={`text-sm ${(userAnalytics?.active_days_change?.positive) ? 'text-green-600' : 'text-red-600'}`}>
                                  {(userAnalytics?.active_days_change?.positive) ? '↑' : '↓'} {userAnalytics?.active_days_change?.value || 0}%
                                </span>
                                <span className="text-sm text-gray-500 ml-1">vs. previous {analyticsTimePeriod}</span>
                              </div>
                            </div>
                          </motion.div>
                          
                          {/* Actions Performed */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-amber-50 text-amber-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Actions Performed</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {formatNumber(userAnalytics?.total_actions || 0)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className={`text-sm ${(userAnalytics?.actions_change?.positive) ? 'text-green-600' : 'text-red-600'}`}>
                                  {(userAnalytics?.actions_change?.positive) ? '↑' : '↓'} {userAnalytics?.actions_change?.value || 0}%
                                </span>
                                <span className="text-sm text-gray-500 ml-1">vs. previous {analyticsTimePeriod}</span>
                              </div>
                            </div>
                          </motion.div>
                          
                          {/* Average Session Time */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-50 text-emerald-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Avg. Session Time</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {userAnalytics?.avg_session_time || '0m 0s'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className={`text-sm ${(userAnalytics?.session_time_change?.positive) ? 'text-green-600' : 'text-red-600'}`}>
                                  {(userAnalytics?.session_time_change?.positive) ? '↑' : '↓'} {userAnalytics?.session_time_change?.value || 0}%
                                </span>
                                <span className="text-sm text-gray-500 ml-1">vs. previous {analyticsTimePeriod}</span>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                        
                        {/* User Activity Chart */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            User Activity Over Time
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
                                    },
                                    title: {
                                      display: false,
                                    },
                                  },
                                  scales: {
                                    y: {
                                      beginAtZero: true,
                                      title: {
                                        display: true,
                                        text: 'Actions'
                                      }
                                    },
                                    x: {
                                      title: {
                                        display: true,
                                        text: 'Date'
                                      }
                                    }
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500">No activity data available</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* User Activity Details */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Most Visited Routes */}
                          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="border-b border-gray-100 px-6 py-4">
                              <h3 className="text-lg font-semibold text-gray-900">
                                Most Accessed Routes
                              </h3>
                            </div>
                            <div className="p-4">
                              {userAnalytics?.top_routes?.length ? (
                                <ul className="divide-y divide-gray-100">
                                  {userAnalytics.top_routes.map((route, index) => (
                                    <li key={index} className="py-3 flex items-center justify-between">
                                      <div className="flex items-center">
                                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-sm">
                                          {index + 1}
                                        </span>
                                        <span className="ml-3 text-sm font-medium text-gray-900">
                                          {route.path || route.route || '/'}
                                        </span>
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {formatNumber(route.visits || route.count || 0)} visits
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-center py-4 text-gray-500">
                                  No route activity data available
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Activity Timeline */}
                          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="border-b border-gray-100 px-6 py-4">
                              <h3 className="text-lg font-semibold text-gray-900">
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
                                            <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                                          ) : null}
                                          <div className="relative flex items-start space-x-3">
                                            <div className="relative">
                                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center ring-8 ring-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                                </svg>
                                              </div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                  {activity.action || 'Unknown activity'}
                                                </div>
                                                <p className="mt-0.5 text-sm text-gray-500">
                                                  {activity.path || activity.route || '/'}
                                                </p>
                                              </div>
                                              <div className="mt-2 text-sm text-gray-500">
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
                                <div className="text-center py-4 text-gray-500">
                                  No recent activity data available
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* General Analytics Header */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <h2 className="text-xl font-bold text-gray-900">
                                System Analytics Overview
                              </h2>
                              <p className="text-gray-500 mt-1">
                                Key performance indicators and usage statistics
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">Last updated:</span>
                              <span className="text-sm font-medium text-gray-900">
                                {formatDate(analyticsSummary?.report_generated_at || new Date().toISOString())}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {/* Active Users */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-indigo-50 text-indigo-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Active Users</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {formatNumber(analyticsSummary?.unique_users || 0)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className={`text-sm ${parseAnalyticsData(analyticsSummary)?.user_change?.positive ? 'text-green-600' : 'text-red-600'}`}>
                                  {parseAnalyticsData(analyticsSummary)?.user_change?.positive ? '↑' : '↓'} {parseAnalyticsData(analyticsSummary)?.user_change?.value || 0}%
                                </span>
                                <span className="text-sm text-gray-500 ml-1">vs. previous {analyticsTimePeriod}</span>
                              </div>
                            </div>
                          </motion.div>
                          
                          {/* Total Visits */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-blue-50 text-blue-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Total Requests</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {formatNumber(analyticsSummary?.total_requests || 0)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className="text-sm text-gray-500">Last 24h:</span>
                                <span className="text-sm font-medium text-gray-900 ml-1">
                                  {formatNumber(analyticsSummary?.requests_24h || 0)}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                          
                          {/* Average Response Time */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-50 text-emerald-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Avg. Response Time</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {formatTime(analyticsSummary?.avg_response_time) || '0ms'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className={`text-sm ${parseAnalyticsData(analyticsSummary)?.session_change?.positive ? 'text-green-600' : 'text-red-600'}`}>
                                  {parseAnalyticsData(analyticsSummary)?.session_change?.positive ? '↑' : '↓'} {parseAnalyticsData(analyticsSummary)?.session_change?.value || 0}%
                                </span>
                                <span className="text-sm text-gray-500 ml-1">vs. previous period</span>
                              </div>
                            </div>
                          </motion.div>
                          
                          {/* Busiest Hour */}
                          <motion.div 
                            whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                          >
                            <div className="flex items-center">
                              <div className="flex-shrink-0 p-3 rounded-xl bg-amber-50 text-amber-700">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="ml-5">
                                <p className="text-sm font-medium text-gray-500">Busiest Hour</p>
                                <p className="mt-1 text-2xl font-bold text-gray-900">
                                  {analyticsSummary?.busiest_hour || '12'}:00
                                </p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="flex items-center">
                                <span className="text-sm text-gray-500">Most active hour of the day</span>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                        
                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          
                          
                          {/* Route Distribution Pie Chart */}
                          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                              Top Routes Distribution
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
                                        },
                                        title: {
                                          display: false,
                                        },
                                        tooltip: {
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
                                  <p className="text-gray-500">No route data available</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Popular Routes Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          <div className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Most Popular Routes
                            </h3>
                            <span className="text-sm text-gray-500">
                              Total requests: {formatNumber(analyticsSummary?.total_requests || 0)}
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Rank
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Route Path
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Requests
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Percentage
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {analyticsSummary?.top_routes && analyticsSummary.top_routes.length > 0 ? (
                                  analyticsSummary.top_routes.map((route, index) => {
                                    const percentage = ((route.count / analyticsSummary.total_requests) * 100).toFixed(1);
                                    return (
                                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                                              {index + 1}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">
                                            {route.route || '/'}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">
                                            {formatNumber(route.count || 0)}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">
                                            {percentage}%
                                          </div>
                                          <div className="w-32 h-2 bg-gray-200 rounded-full mt-2">
                                            <div className="h-full bg-indigo-600 rounded-full" style={{width: `${percentage}%`}}></div>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                      <div className="flex flex-col items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                        </svg>
                                        <p className="text-lg font-medium">No route data available</p>
                                        <p className="text-sm mt-1">Check back after users have interacted with the system</p>
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
                
                {/* ROUTES TAB */}
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            Route Analytics
                          </h2>
                          <p className="text-gray-500 mt-1">
                            Insights into API route usage and performance
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Total Routes */}
                      <motion.div 
                        whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 p-3 rounded-xl bg-indigo-50 text-indigo-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="ml-5">
                            <p className="text-sm font-medium text-gray-500">Unique Routes</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">
                              {formatNumber(analyticsSummary?.top_routes?.length || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-500">
                              Most accessed endpoints
                            </span>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Total Requests */}
                      <motion.div 
                        whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 p-3 rounded-xl bg-blue-50 text-blue-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                          </div>
                          <div className="ml-5">
                            <p className="text-sm font-medium text-gray-500">Total Requests</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">
                              {formatNumber(analyticsSummary?.total_requests || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-500">Last 24h: </span>
                            <span className="text-sm font-medium text-gray-900 ml-1">
                              {formatNumber(analyticsSummary?.requests_24h || 0)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Average Response Time */}
                      <motion.div 
                        whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-50 text-emerald-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-5">
                            <p className="text-sm font-medium text-gray-500">Avg. Response Time</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">
                              {formatTime(analyticsSummary?.avg_response_time) || '0ms'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-500">Average processing time</span>
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Busiest Hour */}
                      <motion.div 
                        whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 p-3 rounded-xl bg-amber-50 text-amber-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-5">
                            <p className="text-sm font-medium text-gray-500">Busiest Hour</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">
                              {analyticsSummary?.busiest_hour || '7'}:00
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-500">Peak traffic hour</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                    
                    {/* Routes Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="border-b border-gray-100 px-6 py-4 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">
                          API Routes Performance
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Route Path
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Requests
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                % of Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {analyticsSummary?.top_routes && analyticsSummary.top_routes.length > 0 ? (
                              analyticsSummary.top_routes.map((route, index) => {
                                const percentage = ((route.count / analyticsSummary.total_requests) * 100).toFixed(1);
                                return (
                                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">
                                        {route.route || '/'}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">
                                        {formatNumber(route.count || 0)}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <span className="text-sm font-medium text-gray-900 w-12">
                                          {percentage}%
                                        </span>
                                        <div className="w-32 h-2 bg-gray-200 rounded-full ml-2">
                                          <div 
                                            className="h-full bg-indigo-600 rounded-full" 
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
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                  <div className="flex flex-col items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <p className="text-lg font-medium">No route data available</p>
                                    <p className="text-sm mt-1">Routes will appear as they are accessed by users</p>
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
                
                {/* HISTORY TAB */}
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            Route Access History
                          </h2>
                          <p className="text-gray-500 mt-1">
                            Detailed log of all route access events
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Showing</span>
                          <span className="text-sm font-medium text-gray-900">
                            {historyData?.length || 0} entries
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* History Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Timestamp
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Method
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Route
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Duration
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {historyData && historyData.length > 0 ? (
                              historyData.map((entry, index) => (
                                <tr key={index} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(entry.timestamp)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm flex items-center justify-center">
                                        <span className="font-medium text-xs">
                                          {entry.user_name ? entry.user_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                                        </span>
                                      </div>
                                      <div className="ml-3">
                                        <div className="text-sm font-medium text-gray-900">
                                          {entry.user_name || 'Unknown user'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {entry.user_id || 'No ID'}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getMethodBadgeStyle(entry.method)}`}>
                                      {entry.method || 'GET'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {entry.route || '/'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {entry.status_code ? (
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                        entry.status_code >= 200 && entry.status_code < 300
                                          ? 'bg-green-100 text-green-800'
                                          : entry.status_code >= 300 && entry.status_code < 400
                                          ? 'bg-blue-100 text-blue-800'
                                          : entry.status_code >= 400 && entry.status_code < 500
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        {entry.status_code}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-500">N/A</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {entry.duration ? `${entry.duration}ms` : 'N/A'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                  <div className="flex flex-col items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-lg font-medium">No history data available</p>
                                    <p className="text-sm mt-1">Route access history will appear here as routes are accessed</p>
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            Analytics Reports
                          </h2>
                          <p className="text-gray-500 mt-1">
                            Comprehensive reports and performance insights
                          </p>
                        </div>
                        <div className="flex items-center">
                          <a 
                            href="#" 
                            onClick={(e) => {
                              e.preventDefault(); 
                              refreshAnalyticsData();
                              showToast("Analytics data refreshed", "success");
                            }}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Refresh Data
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    {/* Performance Scorecard */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="border-b border-gray-100 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          System Performance Scorecard
                        </h3>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {/* User Engagement */}
                          <div className="bg-gray-50 rounded-lg p-5">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4">User Engagement</h4>
                            <div className="space-y-4">
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Active Users</span>
                                  <span className={`text-xs font-medium ${getPerformanceColorClass(analyticsSummary?.unique_users, 10)}`}>
                                    {formatNumber(analyticsSummary?.unique_users || 0)}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full bg-gray-200 rounded overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-600 rounded" 
                                    style={{ width: `${Math.min(((analyticsSummary?.unique_users || 0) / 20) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Avg. Response Time</span>
                                  <span className={`text-xs font-medium ${getPerformanceColorClass(analyticsSummary?.avg_response_time, 0.1)}`}>
                                    {formatTime(analyticsSummary?.avg_response_time) || '0ms'}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full bg-gray-200 rounded overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-600 rounded" 
                                    style={{ width: `${Math.min(((analyticsSummary?.avg_response_time || 0) / 1) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Requests (24h)</span>
                                  <span className={`text-xs font-medium ${getPerformanceColorClass(analyticsSummary?.requests_24h, 500)}`}>
                                    {formatNumber(analyticsSummary?.requests_24h || 0)}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full bg-gray-200 rounded overflow-hidden">
                                  <div 
                                    className="h-full bg-green-600 rounded" 
                                    style={{ width: `${Math.min((analyticsSummary?.requests_24h || 0) / 2000 * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* API Performance */}
                          <div className="bg-gray-50 rounded-lg p-5">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4">Top API Routes</h4>
                            <div className="space-y-3">
                              {analyticsSummary?.top_routes?.slice(0, 3).map((route, index) => (
                                <div key={index}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 truncate w-40" title={route.route}>
                                      {route.route}
                                    </span>
                                    <span className="text-xs font-medium text-gray-900">
                                      {formatNumber(route.count || 0)}
                                    </span>
                                  </div>
                                  <div className="mt-1 h-1.5 w-full bg-gray-200 rounded overflow-hidden">
                                    <div 
                                      className="h-full bg-indigo-600 rounded" 
                                      style={{ width: `${Math.min(((route.count || 0) / (analyticsSummary?.total_requests || 1)) * 100, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Busiest Hours */}
                          <div className="bg-gray-50 rounded-lg p-5 lg:col-span-1 md:col-span-2 lg:row-span-2">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4">Traffic Overview</h4>
                            <div className="space-y-3">
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Total Requests</span>
                                  <span className="text-xs font-medium text-gray-900">
                                    {formatNumber(analyticsSummary?.total_requests || 0)}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full bg-gray-200 rounded overflow-hidden">
                                  <div className="h-full bg-indigo-600 rounded w-full"></div>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Busiest Hour</span>
                                  <span className="text-xs font-medium text-gray-900">
                                    {analyticsSummary?.busiest_hour || '7'}:00
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Peak traffic occurs around this time
                                </div>
                              </div>
                              <div className="pt-2">
                                <div className="text-xs font-medium text-gray-900 mb-2">
                                  Report Summary
                                </div>
                                <div className="text-xs text-gray-600 space-y-1">
                                  <p>
                                    The system has processed <span className="font-medium">{formatNumber(analyticsSummary?.total_requests || 0)}</span> total requests.
                                  </p>
                                  <p>
                                    Average response time is <span className="font-medium">{formatTime(analyticsSummary?.avg_response_time)}</span>.
                                  </p>
                                  <p>
                                    Most active users access <span className="font-medium">{analyticsSummary?.top_routes?.[0]?.route || '/users/me'}</span> the most.
                                  </p>
                                  <p>
                                    System is most active during <span className="font-medium">{analyticsSummary?.busiest_hour || '7'}:00</span> hour.
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
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Modal - Enhanced design with click protection */}
      {showModal && (
        <div 
          className="fixed inset-0 z-10 overflow-y-auto"
          aria-labelledby="modal-title" 
          role="dialog" 
          aria-modal="true"
        >
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Modal backdrop */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 backdrop-blur-sm transition-opacity" 
              aria-hidden="true"
              onClick={closeModal}
            ></div>
            
            {/* This element is to trick the browser into centering the modal contents. */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            {/* Modal panel */}
            <div 
              ref={modalRef}
              className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
              onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching the backdrop
              onKeyDown={handleKeyDown} // Prevent form submission on Enter
            >
              {/* Modal Header with gradient background */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white" id="modal-title">
                    {modalMode === 'add' ? 'Add New User' : 'Edit User'}
                  </h3>
                  <button
                    onClick={closeModal}
                    type="button"
                    className="text-white hover:text-indigo-100 focus:outline-none transition-colors"
                    aria-label="Close modal"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-indigo-100 text-sm mt-1">
                  {modalMode === 'add' 
                    ? 'Enter the details for the new user account.' 
                    : 'Update the information for this user account.'}
                </p>
              </div>
              
              {/* Form content */}
              <form ref={formRef} onSubmit={handleSubmit} className="p-6">
                <div className="space-y-5">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-md">
                      <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        ref={nameInputRef}
                        className={`
                          block w-full px-4 py-3 rounded-lg shadow-sm text-base border-2 transition-all duration-200
                          ${touchedFields.full_name && formErrors.full_name 
                            ? 'border-red-300 text-red-900 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                            : 'border-gray-300 bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:bg-indigo-50'
                          }
                        `}
                        placeholder="John Doe"
                        value={formData.full_name}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        aria-invalid={touchedFields.full_name && !!formErrors.full_name}
                        aria-describedby="full_name-error"
                      />
                      {touchedFields.full_name && formErrors.full_name && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <AnimatePresence>
                      {touchedFields.full_name && formErrors.full_name && (
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 text-sm text-red-600" 
                          id="full_name-error"
                        >
                          {formErrors.full_name}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Department */}
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <select
                      id="department"
                      name="department"
                      className="block w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm text-base bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:bg-indigo-50 transition-all duration-200"
                      value={formData.department}
                      onChange={handleInputChange}
                    >
                      <option value="Pulmonology">Pulmonology</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Orthopedics">Orthopedics</option>
                    </select>
                  </div>
                  
                  {/* Username */}
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-md">
                      <input
                        type="text"
                        id="username"
                        name="username"
                        className={`
                          block w-full px-4 py-3 rounded-lg shadow-sm text-base border-2 transition-all duration-200
                          ${touchedFields.username && formErrors.username 
                            ? 'border-red-300 text-red-900 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                            : 'border-gray-300 bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:bg-indigo-50'
                          }
                          ${modalMode === 'edit' ? 'bg-gray-100' : ''}
                        `}
                        placeholder="johndoe"
                        value={formData.username}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        aria-invalid={touchedFields.username && !!formErrors.username}
                        aria-describedby="username-error"
                        disabled={modalMode === 'edit'}
                      />
                      {touchedFields.username && formErrors.username && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <AnimatePresence>
                      {touchedFields.username && formErrors.username && (
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 text-sm text-red-600" 
                          id="username-error"
                        >
                          {formErrors.username}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-md">
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className={`
                          block w-full px-4 py-3 rounded-lg shadow-sm text-base border-2 transition-all duration-200
                          ${touchedFields.email && formErrors.email 
                            ? 'border-red-300 text-red-900 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                            : 'border-gray-300 bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:bg-indigo-50'
                          }
                          ${modalMode === 'edit' ? 'bg-gray-100' : ''}
                        `}
                        placeholder="john.doe@example.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        aria-invalid={touchedFields.email && !!formErrors.email}
                        aria-describedby="email-error"
                        disabled={modalMode === 'edit'}
                      />
                      {touchedFields.email && formErrors.email && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <AnimatePresence>
                      {touchedFields.email && formErrors.email && (
                        <motion.p 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 text-sm text-red-600" 
                          id="email-error"
                        >
                          {formErrors.email}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Role */}
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      className="block w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm text-base bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:bg-indigo-50 transition-all duration-200"
                      value={formData.role}
                      onChange={handleInputChange}
                    >
                      <option value="user">User</option>
                      <option value="doctor">Doctor</option>
                      <option value="cardroom">Card Room</option>
                      <option value="labroom">Lab Technician</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Assigns permissions and access level for the user account.
                    </p>
                  </div>
                  
                  {/* Status - Checkbox group */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex flex-col space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">Account Settings</h4>
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          id="is_active" 
                          name="is_active" 
                          checked={formData.is_active} 
                          onChange={handleInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-colors"
                          aria-describedby="is_active-description"
                        />
                        <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                          Active account
                        </label>
                      </div>
                      <p id="is_active-description" className="text-xs text-gray-500 ml-6">
                        When active, the user can log in and access the system.
                      </p>
                      
                      <div className="flex items-center">
                        <input 
                          type="checkbox" 
                          id="is_verified" 
                          name="is_verified" 
                          checked={formData.is_verified} 
                          onChange={handleInputChange}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-colors"
                          aria-describedby="is_verified-description"
                        />
                        <label htmlFor="is_verified" className="ml-2 block text-sm text-gray-700">
                          Verified account
                        </label>
                      </div>
                      <p id="is_verified-description" className="text-xs text-gray-500 ml-6">
                        When verified, the user has confirmed their email address.
                      </p>
                    </div>
                  </div>
                  
                  {/* Password - only for adding new users */}
                  {modalMode === 'add' && (
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative rounded-md">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          className={`
                            block w-full px-4 py-3 pr-12 rounded-lg shadow-sm text-base border-2 transition-all duration-200
                            ${touchedFields.password && formErrors.password 
                              ? 'border-red-300 text-red-900 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:bg-indigo-50'
                            }
                          `}
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          aria-invalid={touchedFields.password && !!formErrors.password}
                          aria-describedby="password-error password-hint"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <button
                            type="button"
                            className="text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex="-1"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {/* Password strength indicator */}
                      {formData.password && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 space-y-1"
                        >
                          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${passwordStrength}%` }}
                              className={`absolute top-0 left-0 h-full ${
                                passwordStrength < 40 ? 'bg-red-500' : 
                                passwordStrength < 70 ? 'bg-amber-500' : 
                                passwordStrength < 90 ? 'bg-emerald-500' : 
                                'bg-emerald-500'
                              } transition-all duration-500`}
                            ></motion.div>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Password strength:</span>
                            <span className={
                              passwordStrength < 40 ? 'text-red-600 font-medium' : 
                              passwordStrength < 70 ? 'text-amber-600 font-medium' : 
                              passwordStrength < 90 ? 'text-emerald-600 font-medium' : 
                              'text-emerald-600 font-medium'
                            }>
                              {getPasswordStrengthLabel(passwordStrength)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                      
                      <AnimatePresence>
                        {touchedFields.password && formErrors.password ? (
                          <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 text-sm text-red-600" 
                            id="password-error"
                          >
                            {formErrors.password}
                          </motion.p>
                        ) : (
                          <p className="mt-2 text-xs text-gray-500" id="password-hint">
                            Password must be at least 8 characters with uppercase, lowercase, number, and special character.
                          </p>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  
                  {/* Confirm Password */}
                  {modalMode === 'add' && (
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative rounded-md">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          className={`
                            block w-full px-4 py-3 pr-12 rounded-lg shadow-sm text-base border-2 transition-all duration-200
                            ${touchedFields.confirmPassword && formErrors.confirmPassword 
                              ? 'border-red-300 text-red-900 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 bg-white focus:ring-indigo-500 focus:border-indigo-500 focus:bg-indigo-50'
                            }
                          `}
                          placeholder="••••••••"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                          aria-invalid={touchedFields.confirmPassword && !!formErrors.confirmPassword}
                          aria-describedby="confirm-password-error"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <button
                            type="button"
                            className="text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            tabIndex="-1"
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <AnimatePresence>
                        {touchedFields.confirmPassword && formErrors.confirmPassword && (
                          <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 text-sm text-red-600" 
                            id="confirm-password-error"
                          >
                            {formErrors.confirmPassword}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </form>
              
              {/* Form actions */}
              <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`
                    w-full inline-flex justify-center rounded-lg px-5 py-3
                    bg-gradient-to-r from-indigo-600 to-purple-600 text-base font-medium text-white  
                    hover:from-indigo-700 hover:to-purple-700
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
                    sm:w-auto 
                    transition-all duration-200
                    shadow-sm hover:shadow
                    ${submitting ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                  aria-label={modalMode === 'add' ? 'Add User' : 'Save Changes'}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {modalMode === 'add' ? 'Adding User...' : 'Updating User...'}
                    </>
                  ) : (
                    modalMode === 'add' ? 'Add User' : 'Save Changes'
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="w-full inline-flex justify-center rounded-lg px-5 py-3 border-2 border-gray-300 shadow-sm bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto transition-colors duration-200"
                  aria-label="Cancel"
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, subDays, isBefore } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCalendar, FiDownload, FiFile, FiFileText,  
  FiRefreshCw, FiFilter, FiAlertCircle, FiSearch, FiX, FiCheck, 
  FiInfo, FiChevronDown, FiChevronRight, FiArrowLeft, FiArrowRight,
  FiExternalLink
} from 'react-icons/fi';
import { 
  MdOutlineInsertDriveFile, MdOutlineArticle, MdError, 
  MdOutlineHealthAndSafety, MdOutlineAnalytics, MdOutlineAssessment,
  MdOutlineTimeline, MdOutlineAutoGraph, MdPriorityHigh, MdCheckCircleOutline
} from 'react-icons/md';
import { HiOutlineDocumentReport, HiOutlineDocumentText } from 'react-icons/hi';
import { RiFileChartLine, RiTimerLine } from 'react-icons/ri';
import { TbFileAnalytics, TbReportMedical } from 'react-icons/tb';

// Add Inter font
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
`;

const LabReports = () => {
  // Form states for report generation
  const [reportType, setReportType] = useState('daily');
  const [reportFormat, setReportFormat] = useState('pdf');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [includeMetrics, setIncludeMetrics] = useState(['status', 'priority', 'response_time', 'test_type']);
  
  // Reports list states
  const [reports, setReports] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [filterFromDate, setFilterFromDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [filterToDate, setFilterToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false); 
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [generatedReportId, setGeneratedReportId] = useState(null);
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' or 'list'
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState({});
  
  // Refs for tracking state between renders
  const pollingTimerRef = useRef(null);
  const pollingAttemptCountRef = useRef(0);
  const maxPollingAttempts = 10; 
  const pollingIntervals = useRef([500, 1000, 1000, 1500, 2000, 3000]);
  const isMountedRef = useRef(true);
  const initialFetchDoneRef = useRef(false);
  const fetchInProgressRef = useRef(false);
  const lastResponseRef = useRef(null);
  
  // CRITICAL FIX: Hardcode the correct backend API URL
  // This should be the URL of your backend API service
  const apiBaseUrl = 'http://localhost:8025';
  
  // Available metrics options with enhanced icons
  const metricsOptions = [
    { id: 'status', label: 'Status Breakdown', icon: <MdCheckCircleOutline className="w-5 h-5" /> },
    { id: 'priority', label: 'Priority Distribution', icon: <MdPriorityHigh className="w-5 h-5" /> },
    { id: 'response_time', label: 'Response Time Analytics', icon: <RiTimerLine className="w-5 h-5" /> },
    { id: 'test_type', label: 'Test Type Analysis', icon: <TbReportMedical className="w-5 h-5" /> },
    { id: 'technician', label: 'Technician Performance', icon: <MdOutlineAnalytics className="w-5 h-5" /> },
    { id: 'daily_trend', label: 'Daily Request Trends', icon: <MdOutlineAutoGraph className="w-5 h-5" /> }
  ];
  
  // Set isMountedRef to false when component unmounts
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Clean up all timeouts
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);
  
  // Update document class for dark mode when it changes
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
  
  // Initial data load 
  useEffect(() => {
    console.log("Initial component mount - fetching reports");
    fetchReports(true);
  }, []); 
  
  // Fetch reports when tab changes to 'list'
  useEffect(() => {
    console.log("Tab changed to:", activeTab);
    if (activeTab === 'list') {
      fetchReports(true);
    }
    
    // Reset generating state when switching tabs
    if (activeTab === 'generate') {
      setGenerating(false);
    }
  }, [activeTab]); 
  
  // Fetch reports when filters or pagination change
  useEffect(() => {
    if (activeTab === 'list') {
      fetchReports(false);
    }
  }, [currentPage, pageSize, filterType, filterFromDate, filterToDate]);
  
  // Update report status in the reports array
  const updateReportStatus = (reportId, status) => {
    console.log(`Updating report ${reportId} status to ${status}`);
    setReports(prevReports => {
      return prevReports.map(report => {
        if (report.id === reportId) {
          return { ...report, status };
        }
        return report;
      });
    });
  };
  
  // SIMPLIFIED: Fetch reports list with filters and pagination
  const fetchReports = async (forceRefresh = false) => {
    if (loading && !forceRefresh) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        _t: Date.now() // Cache busting
      };
      
      if (filterType) params.report_type = filterType;
      if (filterFromDate) params.from_date = filterFromDate;
      if (filterToDate) params.to_date = filterToDate;
      
      console.log("Fetching reports with params:", params);
      
      // Make the API request with proper error handling
      const response = await axios.get(`${apiBaseUrl}/api/reports/`, { 
        params,
        // Add headers to help with debugging
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // Increase timeout to give server more time to respond
        timeout: 10000
      });
      
      console.log("API Response:", response.data);
      
      if (response.data && response.data.success) {
        const reportsList = response.data.reports || [];
        console.log(`Received ${reportsList.length} reports from API`);
        
        // Manually log the first report to verify format
        if (reportsList.length > 0) {
          console.log("First report:", reportsList[0]);
        }
        
        setReports(reportsList);
        setTotalPages(response.data.pagination?.total_pages || 1);
        setTotalCount(response.data.pagination?.total || 0);
        setReportsLoaded(true);
        
        // Check for the specific generated report if we're tracking one
        if (generatedReportId) {
          const generatedReport = reportsList.find(r => r.id === generatedReportId);
          if (generatedReport) {
            if (generatedReport.status === 'ready') {
              setGenerating(false);
              setSuccess('Report is ready for download');
            }
          }
        }
      } else {
        setError(`Failed to fetch reports: ${response.data?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      
      // Better error handling with more details
      let errorMessage = 'Error connecting to server';
      
      if (err.response) {
        // Server responded with error status
        errorMessage = `Server error (${err.response.status}): ${err.response.data?.detail || 'Unknown error'}`;
      } else if (err.request) {
        // Request made but no response received
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Error setting up request
        errorMessage = `Request error: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle report generation form submission
  const handleGenerateReport = async (e) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (generating) return;
    
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGeneratedReportId(null);
    
    try {
      // Validate date range for custom reports
      if (reportType === 'custom') {
        if (!startDate || !endDate) {
          throw new Error('Start and end dates are required for custom reports');
        }
        
        if (new Date(startDate) > new Date(endDate)) {
          throw new Error('Start date must be before end date');
        }
        
        const daysDiff = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
        if (daysDiff > 366) {
          throw new Error('Date range cannot exceed 1 year');
        }
      }
      
      // Prepare request data
      const requestData = {
        report_type: reportType,
        format: reportFormat,
        include_metrics: includeMetrics.length > 0 ? includeMetrics : ['all'],
      };
      
      if (reportType === 'custom') {
        requestData.start_date = startDate;
        requestData.end_date = endDate;
      }
      
      console.log('Generating report with data:', requestData);
      
      // Submit request
      const response = await axios.post(`${apiBaseUrl}/api/reports/generate`, requestData);
      
      console.log('Generate report response:', response.data);
      
      if (response.data.success) {
        setSuccess('Report generation started successfully');
        
        if (response.data.report_id) {
          // Store the report ID for later reference
          const reportId = response.data.report_id;
          setGeneratedReportId(reportId);
          
          // Switch to list tab to show progress
          setActiveTab('list');
          
          // Fetch reports list to update the UI
          await fetchReports(true);
          
          // Set success and stop generating after a short delay
          setTimeout(() => {
            setGenerating(false);
            setSuccess('Report is ready for download');
          }, 2000);
        } else {
          setGenerating(false);
          setError('No report ID received from the server');
        }
      } else {
        setError('Failed to start report generation');
        setGenerating(false);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError(`Error: ${err.response?.data?.detail || err.message}`);
      setGenerating(false);
    }
  };
  
  // Download a report
  const handleDownload = (reportId) => {
    // Prevent multiple simultaneous downloads
    if (downloadInProgress) return;
    
    setDownloadInProgress(true);
    setSuccess(`Downloading report ${reportId}...`);
    
    try {
      // Get report format
      const reportToDownload = reports.find(r => r.id === reportId);
      const format = reportToDownload?.report_format || 'pdf';
      
      // Create a direct link to download
      const link = document.createElement('a');
      const timestamp = new Date().getTime();
      
      // Set the correct API URL for downloading
      link.href = `${apiBaseUrl}/api/reports/${reportId}/download?_t=${timestamp}`;
      link.setAttribute('download', `report_${reportId}.${format}`);
      link.setAttribute('target', '_blank');
      
      // Append, click, and clean up
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Download initiated. Check your downloads folder.');
      setDownloadSuccess({...downloadSuccess, [reportId]: true});
    } catch (err) {
      console.error('Download error:', err);
      setError(`Error downloading report: ${err.message}`);
    } finally {
      setTimeout(() => {
        setDownloadInProgress(false);
      }, 2000);
    }
  };
  
  // Open report in a new tab
  const openReportInNewTab = (reportId) => {
    const url = `${apiBaseUrl}/api/reports/${reportId}/download?_t=${new Date().getTime()}`;
    window.open(url, '_blank');
  };
  
  // Get badge color based on report status
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ready':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30';
      case 'generating':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/30';
      case 'error':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/30';
      case 'missing':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-300 border border-slate-200 dark:border-slate-700/30';
    }
  };
  
  // Get icon based on report format
  const getFormatIcon = (format) => {
    switch (format) {
      case 'pdf':
        return <MdOutlineInsertDriveFile className="h-5 w-5 text-rose-500" />;
      case 'txt':
        return <MdOutlineArticle className="h-5 w-5 text-sky-500" />;
      default:
        return <FiFile className="h-5 w-5 text-slate-500" />;
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };
  
  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };
  
  // Apply filters
  const handleApplyFilters = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when filters change
    fetchReports(true);
  };
  
  // Reset filters
  const handleResetFilters = () => {
    setFilterType('');
    setFilterFromDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setFilterToDate(format(new Date(), 'yyyy-MM-dd'));
    setCurrentPage(1);
    fetchReports(true);
  };
  
  // Toggle metrics selection
  const toggleMetric = (metricId) => {
    if (includeMetrics.includes(metricId)) {
      setIncludeMetrics(includeMetrics.filter(id => id !== metricId));
    } else {
      setIncludeMetrics([...includeMetrics, metricId]);
    }
  };
  
  // Handle report type change
  const handleReportTypeChange = (type) => {
    setReportType(type);
    
    // Show date range picker only for custom reports
    setShowDateRangePicker(type === 'custom');
    
    // Set default date range based on report type
    const today = new Date();
    
    if (type === 'daily') {
      setStartDate(format(today, 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (type === 'weekly') {
      setStartDate(format(subDays(today, 7), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (type === 'monthly') {
      setStartDate(format(subDays(today, 30), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    }
  };

  return (
    <div className="font-[Inter,system-ui,sans-serif] space-y-6 p-6 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen transition-colors duration-300">
      <style>{fontStyle}</style>
      
      {/* CSS for custom styling */}
      <style>
        {`
          /* Custom scrollbar */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          
          ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.03);
            border-radius: 8px;
          }
          
          ::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.12);
            border-radius: 8px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.2);
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
          
          /* Progress and Shimmer animations */
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          
          .shimmer-effect {
            position: relative;
            overflow: hidden;
          }
          
          .shimmer-effect::after {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            background-image: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0) 0,
              rgba(255, 255, 255, 0.2) 20%,
              rgba(255, 255, 255, 0.5) 60%,
              rgba(255, 255, 255, 0)
            );
            animation: shimmer 2s infinite;
            content: '';
          }
          
          .dark .shimmer-effect::after {
            background-image: linear-gradient(
              90deg,
              rgba(255, 255, 255, 0) 0,
              rgba(255, 255, 255, 0.07) 20%,
              rgba(255, 255, 255, 0.1) 60%,
              rgba(255, 255, 255, 0)
            );
          }
        `}
      </style>
      
      {/* Page Header with subtle 3D and gradient effects */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20 mr-4">
            <HiOutlineDocumentReport className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Laboratory Reports</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Generate and manage comprehensive lab analytics</p>
          </div>
        </div>
        
        {/* View Toggle with animated selection */}
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('generate')}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition duration-200 ${
              activeTab === 'generate' 
                ? 'text-sky-600 dark:text-sky-400' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Generate Report
            {activeTab === 'generate' && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-sky-50 dark:bg-sky-900/30 rounded-md -z-10"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition duration-200 ${
              activeTab === 'list' 
                ? 'text-sky-600 dark:text-sky-400' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            View Reports
            {activeTab === 'list' && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-sky-50 dark:bg-sky-900/30 rounded-md -z-10"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        </div>
      </div>
      
      {/* API Connection Info - ADDED FOR DEBUGGING */}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg text-xs">
        <div className="flex justify-between">
          <span><strong>API URL:</strong> {apiBaseUrl}/api/reports/</span>
          <span><strong>Status:</strong> {loading ? 'Connecting...' : error ? 'Error' : 'Connected'}</span>
        </div>
      </div>
      
      {/* Notification Messages with smooth animations */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg relative flex items-center dark:bg-emerald-900/30 dark:border-emerald-800/30 dark:text-emerald-300" 
            role="alert"
          >
            <div className="flex-shrink-0 mr-2">
              <FiCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="block sm:inline">{success}</span>
            <button 
              className="absolute top-0 bottom-0 right-0 px-4 py-3 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
              onClick={() => setSuccess(null)}
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>
          </motion.div>
        )}
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg relative flex items-center dark:bg-rose-900/30 dark:border-rose-800/30 dark:text-rose-300" 
            role="alert"
          >
            <div className="flex-shrink-0 mr-2">
              <FiAlertCircle className="h-5 w-5 text-rose-500" />
            </div>
            <span className="block sm:inline">{error}</span>
            <button 
              className="absolute top-0 bottom-0 right-0 px-4 py-3 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 transition-colors"
              onClick={() => setError(null)}
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Generate Report Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'generate' && (
          <motion.div 
            key="generate-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mr-3">
                    <TbFileAnalytics className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Generate New Report</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Configure your report parameters</p>
                  </div>
                </div>
              </div>
              
              <form onSubmit={handleGenerateReport} className="p-6 space-y-8">
                {/* Report Type with improved visuals and animations */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">Report Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['daily', 'weekly', 'monthly', 'custom'].map((type) => (
                      <motion.button
                        key={type}
                        type="button"
                        onClick={() => handleReportTypeChange(type)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative px-4 py-3 rounded-lg border ${
                          reportType === type
                            ? 'border-sky-300 dark:border-sky-700 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        } transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
                      >
                        <div className="flex flex-col items-center space-y-1.5">
                          {type === 'daily' && (
                            <FiCalendar className={`h-5 w-5 ${reportType === type ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400'}`} />
                          )}
                          {type === 'weekly' && (
                            <MdOutlineTimeline className={`h-5 w-5 ${reportType === type ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400'}`} />
                          )}
                          {type === 'monthly' && (
                            <MdOutlineAssessment className={`h-5 w-5 ${reportType === type ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400'}`} />
                          )}
                          {type === 'custom' && (
                            <FiFilter className={`h-5 w-5 ${reportType === type ? 'text-sky-500' : 'text-slate-500 dark:text-slate-400'}`} />
                          )}
                          <span className={`text-sm font-medium capitalize ${
                            reportType === type 
                              ? 'text-sky-700 dark:text-sky-300' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {type}
                          </span>
                        </div>
                        {reportType === type && (
                          <motion.div 
                            layoutId="reportTypeHighlight"
                            className="absolute inset-0 bg-sky-50 dark:bg-sky-900/20 rounded-lg -z-10"
                            initial={false}
                            transition={{ type: "spring", bounce: 0.2 }}
                          />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
                
                {/* Date Range with improved interaction and accessibility */}
                <AnimatePresence>
                  {showDateRangePicker && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-sky-50 dark:bg-sky-900/10 rounded-xl p-4 border border-sky-100 dark:border-sky-900/20">
                        <div className="text-sm font-medium mb-3 text-sky-800 dark:text-sky-300 flex items-center">
                          <FiCalendar className="mr-2 h-4 w-4" />
                          Custom Date Range
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="start-date" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                              Start Date
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiCalendar className="text-slate-400 dark:text-slate-500" />
                              </div>
                              <input
                                id="start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-10 py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-600 focus:border-transparent transition-colors duration-200 text-sm"
                                required={reportType === 'custom'}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label htmlFor="end-date" className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                              End Date
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiCalendar className="text-slate-400 dark:text-slate-500" />
                              </div>
                              <input
                                id="end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full pl-10 py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-600 focus:border-transparent transition-colors duration-200 text-sm"
                                required={reportType === 'custom'}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Date range validation message */}
                        {startDate && endDate && new Date(startDate) > new Date(endDate) && (
                          <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center">
                            <FiAlertCircle className="mr-1 h-3 w-3" />
                            Start date must be before end date
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Report Format with enhanced visuals */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">Report Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      onClick={() => setReportFormat('pdf')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative px-4 py-3 rounded-lg border ${
                        reportFormat === 'pdf'
                          ? 'border-rose-300 dark:border-rose-700 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      } transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500`}
                    >
                      <div className="flex items-center justify-center">
                        <MdOutlineInsertDriveFile className={`h-6 w-6 mr-2 ${reportFormat === 'pdf' ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span className={`text-sm font-medium ${
                          reportFormat === 'pdf' 
                            ? 'text-rose-700 dark:text-rose-300' 
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          PDF
                        </span>
                      </div>
                      {reportFormat === 'pdf' && (
                        <motion.div 
                          layoutId="reportFormatHighlight"
                          className="absolute inset-0 bg-rose-50 dark:bg-rose-900/10 rounded-lg -z-10"
                          initial={false}
                          transition={{ type: "spring", bounce: 0.2 }}
                        />
                      )}
                    </motion.button>
                    
                    <motion.button
                      type="button"
                      onClick={() => setReportFormat('txt')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative px-4 py-3 rounded-lg border ${
                        reportFormat === 'txt'
                          ? 'border-blue-300 dark:border-blue-700 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      } transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                    >
                      <div className="flex items-center justify-center">
                        <MdOutlineArticle className={`h-6 w-6 mr-2 ${reportFormat === 'txt' ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span className={`text-sm font-medium ${
                          reportFormat === 'txt' 
                            ? 'text-blue-700 dark:text-blue-300' 
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          TXT
                        </span>
                      </div>
                      {reportFormat === 'txt' && (
                        <motion.div 
                          layoutId="reportFormatHighlight"
                          className="absolute inset-0 bg-blue-50 dark:bg-blue-900/10 rounded-lg -z-10"
                          initial={false}
                          transition={{ type: "spring", bounce: 0.2 }}
                        />
                      )}
                    </motion.button>
                  </div>
                </div>
                
                {/* Included Metrics with enhanced interactivity and visuals */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">Include Metrics</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {metricsOptions.map(metric => (
                      <motion.div 
                        key={metric.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => toggleMetric(metric.id)}
                        className={`px-4 py-3 rounded-lg border ${
                          includeMetrics.includes(metric.id)
                            ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                        } cursor-pointer transition-colors duration-200 flex items-center`}
                      >
                        <div className={`flex-shrink-0 w-6 h-6 rounded-md border-2 mr-3 flex items-center justify-center ${
                          includeMetrics.includes(metric.id)
                            ? 'bg-indigo-500 border-indigo-500 dark:bg-indigo-600 dark:border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {includeMetrics.includes(metric.id) && (
                            <FiCheck className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${
                            includeMetrics.includes(metric.id) 
                              ? 'text-indigo-700 dark:text-indigo-300' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {metric.label}
                          </span>
                        </div>
                        <div className={`flex-shrink-0 ${
                          includeMetrics.includes(metric.id) 
                            ? 'text-indigo-500 dark:text-indigo-400' 
                            : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {metric.icon}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
                
                {/* Submit Button with premium design and loading state */}
                <motion.div 
                  className="pt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.button
                    type="submit"
                    disabled={generating}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`w-full py-3 px-4 rounded-lg ${
                      generating
                        ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700'
                    } text-white font-medium shadow-sm flex items-center justify-center space-x-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2`}
                  >
                    {generating ? (
                      <>
                        <FiRefreshCw className="animate-spin h-5 w-5" />
                        <span>Generating Report...</span>
                      </>
                    ) : (
                      <>
                        <RiFileChartLine className="h-5 w-5" />
                        <span>Generate Report</span>
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </form>
            </div>
          </motion.div>
        )}
        
        {/* Reports List Tab */}
        {activeTab === 'list' && (
          <motion.div 
            key="list-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Enhanced Filters UI */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-medium text-slate-800 dark:text-white flex items-center">
                    <FiFilter className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" />
                    Filter Reports
                  </h3>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleApplyFilters} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
                  <div className="md:col-span-3">
                    <label htmlFor="filter-type" className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                      Report Type
                    </label>
                    <div className="relative">
                      <select
                        id="filter-type"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-600 focus:border-transparent appearance-none transition-colors duration-200 text-sm"
                      >
                        <option value="">All Types</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <FiChevronDown className="text-slate-400" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="md:col-span-3">
                    <label htmlFor="filter-from-date" className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                      From Date
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="text-slate-400 h-4 w-4" />
                      </div>
                      <input
                        id="filter-from-date"
                        type="date"
                        value={filterFromDate}
                        onChange={(e) => setFilterFromDate(e.target.value)}
                        className="w-full pl-10 py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-600 focus:border-transparent transition-colors duration-200 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-3">
                    <label htmlFor="filter-to-date" className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">
                      To Date
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="text-slate-400 h-4 w-4" />
                      </div>
                      <input
                        id="filter-to-date"
                        type="date"
                        value={filterToDate}
                        onChange={(e) => setFilterToDate(e.target.value)}
                        className="w-full pl-10 py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-600 focus:border-transparent transition-colors duration-200 text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-1 flex items-end">
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg flex items-center justify-center transition-colors duration-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    >
                      <FiSearch className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </form>
            </div>
            
            {/* Reports Table with premium styling */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/60 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mr-3">
                    <FiFileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Generated Reports</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {totalCount} {totalCount === 1 ? 'report' : 'reports'} found
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fetchReports(true)}
                    className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700/50 rounded-md transition-colors duration-200"
                    title="Refresh reports"
                    aria-label="Refresh reports"
                  >
                    <FiRefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                  </motion.button>
                </div>
              </div>
              
              {/* CRITICAL FIX: Add debug info to help troubleshoot */}
              <div className="px-6 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60">
                API Status: {loading ? 'Loading data...' : (reports.length > 0 ? 'Found ' + reports.length + ' reports' : 'No reports found')}
              </div>
              
              {/* Loading state with skeleton loader for better UX */}
              {loading ? (
                <div className="space-y-4 p-6">
                  {/* Skeleton loader for table */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4 animate-pulse">
                      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      </div>
                      <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    </div>
                  ))}
                  <div className="text-center text-slate-500 dark:text-slate-400 pt-3">
                    Loading reports...
                  </div>
                </div>
              ) : reports.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                    <HiOutlineDocumentText className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-1">No reports found</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    Try adjusting your filters or generate a new report using the "Generate Report" tab.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTab('generate')}
                    className="mt-4 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg flex items-center transition-colors duration-200 text-sm"
                  >
                    <HiOutlineDocumentReport className="mr-2 h-4 w-4" />
                    Generate New Report
                  </motion.button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/30">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">
                          Format
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">
                          Report Type
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">
                          Date Range
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">
                          Created
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider dark:text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                      {reports.map((report) => (
                        <motion.tr 
                          key={report.id} 
                          initial={generatedReportId === report.id ? { backgroundColor: 'rgba(14, 165, 233, 0.1)' } : {}}
                          animate={generatedReportId === report.id ? { 
                            backgroundColor: ['rgba(14, 165, 233, 0.1)', 'rgba(14, 165, 233, 0)', 'rgba(14, 165, 233, 0.1)'],
                          } : {}}
                          transition={{ repeat: 2, duration: 1.5 }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getFormatIcon(report.report_format)}
                              <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                {report.report_format?.toUpperCase() || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                              {report.report_type || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {report.date_range_start && report.date_range_end ? (
                                <>
                                  {new Date(report.date_range_start).toLocaleDateString()} - {new Date(report.date_range_end).toLocaleDateString()}
                                </>
                              ) : (
                                'N/A'
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {formatDate(report.created_at)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusBadgeClass(report.status)}`}>
                              {report.status === 'ready' || report.id === generatedReportId ? (
                                <span className="flex items-center">
                                  Ready to download
                                </span>
                              ) : (
                                <span className="capitalize">
                                  {report.status?.charAt(0).toUpperCase() + report.status?.slice(1) || 'Unknown'}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-2">
                              {/* Always show download button */}
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDownload(report.id)}
                                disabled={downloadInProgress}
                                className="inline-flex items-center px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-medium rounded-md border border-sky-200 transition-colors duration-150 dark:bg-sky-900/20 dark:hover:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/30 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <FiDownload className="mr-1.5 h-3.5 w-3.5" />
                                Download
                              </motion.button>
                              
                              {/* Open in Browser button - helps with direct access */}
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openReportInNewTab(report.id)}
                                className="inline-flex items-center px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-md border border-slate-200 transition-colors duration-150 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 dark:text-slate-300 dark:border-slate-700/50"
                                title="Open in browser"
                              >
                                <FiExternalLink className="h-3.5 w-3.5" />
                              </motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Enhanced Pagination UI */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Showing <span className="font-medium">{Math.min(((currentPage - 1) * pageSize) + 1, totalCount)}</span> to{" "}
                      <span className="font-medium">
                        {Math.min(currentPage * pageSize, totalCount)}
                      </span>{" "}
                      of <span className="font-medium">{totalCount}</span> results
                    </div>
                    
                    <nav className="flex justify-center sm:justify-end items-center space-x-1" aria-label="Pagination">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                          currentPage === 1
                            ? 'text-slate-400 cursor-not-allowed dark:text-slate-600'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                        }`}
                        aria-label="Previous page"
                      >
                        <FiArrowLeft className="h-5 w-5" />
                      </motion.button>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        
                        // If fewer than 5 pages, show all
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        }
                        // If current page is near the beginning
                        else if (currentPage <= 3) {
                          pageNum = i + 1;
                        }
                        // If current page is near the end
                        else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        }
                        // If current page is in the middle
                        else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        // Don't show invalid page numbers
                        if (pageNum <= 0 || pageNum > totalPages) return null;
                        
                        return (
                          <motion.button
                            key={pageNum}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handlePageChange(pageNum)}
                            className={`relative h-8 w-8 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                              currentPage === pageNum
                                ? 'z-10 bg-sky-500 text-white'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                            } transition-colors duration-150`}
                            aria-label={`Page ${pageNum}`}
                            aria-current={currentPage === pageNum ? 'page' : undefined}
                          >
                            {pageNum}
                          </motion.button>
                        );
                      })}
                      
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                          currentPage === totalPages
                            ? 'text-slate-400 cursor-not-allowed dark:text-slate-600'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                        }`}
                        aria-label="Next page"
                      >
                        <FiArrowRight className="h-5 w-5" />
                      </motion.button>
                    </nav>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LabReports;
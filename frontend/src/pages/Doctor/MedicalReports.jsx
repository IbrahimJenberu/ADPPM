import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FiSearch,
  FiPlus,
  FiDownload,
  FiFile,
  FiX,
  FiCheckCircle,
  FiArrowLeft,
  FiUser,
  FiAlertCircle,
  FiCalendar,
  FiClock,
  FiChevronDown,
  FiChevronRight,
  FiInfo,
  FiChevronLeft,
  FiTrash2,
  FiActivity,
  FiRefreshCw
} from "react-icons/fi";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useAuth } from "../../contexts/AuthContext";

export default function DoctorMedicalReports() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [viewingPatient, setViewingPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [patients, setPatients] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [debugResponse, setDebugResponse] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Key for forcing re-render when navigating back
  const [renderKey, setRenderKey] = useState(0);
  
  // Refs to prevent duplicate API calls and store cached patients
  const isFetchingRef = useRef(false);
  const patientsCacheRef = useRef([]);
  
  // Pagination state - removed pagination for reports
  const [currentPatientPage, setCurrentPatientPage] = useState(1);
  const patientsPerPage = 8;

  // Refs for scroll animations
  const [patientListRef, patientListInView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const [newReport, setNewReport] = useState({
    patient_id: "",
    patientName: "",
    type: "Consultation",
    observations: "",
    diagnosis: "",
    treatment: "",
    recommendations: "",
    format_type: "pdf",
    prescriptions: ["None"],
  });

  // Create staggered animation for patient cards
  const controls = useAnimation();
  useEffect(() => {
    if (patientListInView) {
      controls.start((i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.05, duration: 0.4 }
      }));
    }
  }, [controls, patientListInView]);

  // Track dark mode changes
  useEffect(() => {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e) => {
        setIsDarkMode(e.matches);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, []);

  // Apply dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Fetch patients on component load
  useEffect(() => {
    if (user?.id) {
      fetchPatients();
    }
  }, [user]);

  // Direct data handler to ensure we have patients data
  useEffect(() => {
    if (patients.length > 0) {
      patientsCacheRef.current = [...patients];
    } else if (patientsCacheRef.current.length > 0 && !isLoadingPatients) {
      console.log("Restoring patients from cache to state");
      setPatients([...patientsCacheRef.current]);
    }
  }, [patients, isLoadingPatients]);

  // Fetch reports when a patient is selected for viewing
  useEffect(() => {
    if (viewingPatient?.id) {
      fetchPatientReports(viewingPatient.id);
    }
  }, [viewingPatient]);

  // Automatically hide success messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchPatients = async () => {
    if (!user?.id || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsLoadingPatients(true);
    setErrorMessage("");
    
    try {
      console.log("Fetching patients for doctor ID:", user.id);
      
      // Use a small delay to ensure proper loading state is visible
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const response = await fetch(
        `http://localhost:8024/patients?doctor_id=${user.id}`
      );
      
      console.log("Patients API Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch patients. Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Patients API Response data received, patient count:", data.patients?.length);
      
      if (data.success) {
        if (Array.isArray(data.patients) && data.patients.length > 0) {
          // Store in state and cache
          patientsCacheRef.current = [...data.patients];
          setPatients([...data.patients]);
          console.log("Patients data cached and set to state. Count:", data.patients.length);
        } else {
          console.warn("API returned empty or invalid patients array:", data.patients);
          setPatients([]);
          patientsCacheRef.current = [];
        }
      } else {
        throw new Error(data.message || "Failed to fetch patients");
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
      setErrorMessage(`Failed to load patients: ${error.message}. Please try again.`);
    } finally {
      setIsLoadingPatients(false);
      isFetchingRef.current = false;
    }
  };

  const fetchPatientReports = async (patientId) => {
    if (!user?.id || !patientId) return;

    setIsLoadingReports(true);
    try {
      // Updated to match backend API structure
      const response = await fetch(
        `http://localhost:8024/reports/?patient_id=${patientId}&doctor_id=${user.id}`
      );
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      if (data.success) {
        setReports(data.reports);
      } else {
        throw new Error(data.message || "Failed to fetch reports");
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      setErrorMessage("Failed to load reports. Please try again.");
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewReport((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear validation error when field is updated
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setNewReport((prev) => ({
      ...prev,
      patient_id: patient.id,
      patientName: patient.name || patient.first_name,
    }));
    setShowReportForm(true);
  };

  const handleViewPatientReports = (patient) => {
    setViewingPatient(patient);
  };

  const handleBackToPatients = () => {
    console.log("Navigating back to patients list");
    
    // First reset states in order
    setReports([]);
    setSearchTerm("");
    setCurrentPatientPage(1);
    
    // Force a re-render
    setRenderKey(prev => prev + 1);
    
    // Show loading state for visual feedback
    setIsLoadingPatients(true);
    
    // Restore patients from cache immediately if available
    if (patientsCacheRef.current.length > 0) {
      console.log("Restoring patients data from cache, count:", patientsCacheRef.current.length);
      setPatients([...patientsCacheRef.current]);
      setIsLoadingPatients(false);
    } else {
      // Fallback to API call
      console.log("Cache empty, fetching patients with API");
      fetchPatients();
    }
    
    // Important: Clear the viewingPatient state AFTER other state updates
    // This ensures the UI transitions back to the patients view properly
    setViewingPatient(null);
  };

  const handleManualRefresh = () => {
    if (isFetchingRef.current) return;
    
    console.log("Manual refresh requested");
    setIsLoadingPatients(true);
    // Clear the cache to force a fresh fetch
    patientsCacheRef.current = [];
    fetchPatients();
  };

  const validateForm = () => {
    const errors = {};
    if (!newReport.patient_id) {
      errors.patient_id = "Patient is required";
    }
    if (!newReport.diagnosis || newReport.diagnosis.trim() === "") {
      errors.diagnosis = "Diagnosis is required";
    }
    if (!newReport.treatment || newReport.treatment.trim() === "") {
      errors.treatment = "Treatment plan is required";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      setErrorMessage("Please fix the validation errors before submitting");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage("");
    setErrorDetails(null);
    setDebugResponse(null);
  
    try {
      // Make sure prescriptions is never empty
      const prescriptions = newReport.prescriptions.filter(p => p && p.trim() !== "");
      if (prescriptions.length === 0) {
        prescriptions.push("None");
      }
  
      // Create the request body exactly as the backend expects
      const requestBody = {
        patient_id: newReport.patient_id,
        diagnosis: newReport.diagnosis.trim(),
        treatment: newReport.treatment.trim(),
        prescriptions: prescriptions,
        observations: newReport.observations?.trim() || "",
        recommendations: newReport.recommendations?.trim() || "",
        format_type: newReport.format_type || "pdf"
      };
  
      console.log("Sending report data:", JSON.stringify(requestBody, null, 2));
  
      // Updated endpoint to match backend API structure
      const response = await fetch(
        `http://localhost:8024/reports/?doctor_id=${user.id}`,
        {
          method: "POST",
          headers: {
            "accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );
  
      const responseData = await response.json();
      setDebugResponse(responseData);
  
      if (!response.ok) {
        // Handle specific API error format
        if (responseData.detail) {
          if (typeof responseData.detail === 'object') {
            setErrorDetails(responseData.detail);
            throw new Error(responseData.detail.message || "Failed to generate report");
          } else {
            throw new Error(responseData.detail || "Failed to generate report");
          }
        } else {
          throw new Error("Failed to generate report. Server returned an error.");
        }
      }
  
      if (responseData.success) {
        // Refresh reports if we're viewing this patient's reports
        if (viewingPatient?.id === newReport.patient_id) {
          fetchPatientReports(viewingPatient.id);
        }
  
        setSuccessMessage("Medical report generated successfully!");
  
        // Reset form state
        setShowReportForm(false);
        setSelectedPatient(null);
        setNewReport({
          patient_id: "",
          patientName: "",
          type: "Consultation",
          observations: "",
          diagnosis: "",
          treatment: "",
          recommendations: "",
          format_type: "pdf",
          prescriptions: ["None"],
        });
      } else {
        throw new Error(responseData.message || "Failed to generate report");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setErrorMessage(error.message || "Failed to generate report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete || !user?.id) return;
    
    setIsLoading(true);
    setErrorMessage("");
    setErrorDetails(null);
    
    try {
      // Build the URL with query parameters
      const deleteUrl = `http://localhost:8024/reports/${reportToDelete}?doctor_id=${user.id}${deletionReason ? `&deletion_reason=${encodeURIComponent(deletionReason)}` : ''}`;
      
      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "accept": "application/json"
        }
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        if (responseData.detail) {
          if (typeof responseData.detail === 'object') {
            setErrorDetails(responseData.detail);
            throw new Error(responseData.detail.message || "Failed to delete report");
          } else {
            throw new Error(responseData.detail || "Failed to delete report");
          }
        } else {
          throw new Error("Failed to delete report. Server returned an error.");
        }
      }
      
      if (responseData.success) {
        // Refresh reports list
        if (viewingPatient?.id) {
          fetchPatientReports(viewingPatient.id);
        }
        
        setSuccessMessage("Medical report deleted successfully!");
      } else {
        throw new Error(responseData.message || "Failed to delete report");
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      setErrorMessage(error.message || "Failed to delete report. Please try again.");
    } finally {
      setIsLoading(false);
      setShowDeleteConfirmation(false);
      setReportToDelete(null);
      setDeletionReason("");
    }
  };

  const handleConfirmDelete = (reportId) => {
    setReportToDelete(reportId);
    setShowDeleteConfirmation(true);
  };

  const handleDownloadReport = async (reportId) => {
    try {
      if (!user?.id) return;

      // Direct browser to download the file
      window.open(
        `http://localhost:8024/reports/${reportId}/download?doctor_id=${user.id}`,
        "_blank"
      );

      setSuccessMessage("Report download initiated!");
    } catch (error) {
      console.error("Error downloading report:", error);
      setErrorMessage("Failed to download report. Please try again.");
    }
  };

  const addPrescription = () => {
    setNewReport(prev => ({
      ...prev,
      prescriptions: [...prev.prescriptions, ""]
    }));
  };

  const removePrescription = (index) => {
    setNewReport(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.filter((_, i) => i !== index)
    }));
  };

  const handlePrescriptionChange = (index, value) => {
    setNewReport(prev => {
      const updatedPrescriptions = [...prev.prescriptions];
      updatedPrescriptions[index] = value;
      return {
        ...prev,
        prescriptions: updatedPrescriptions
      };
    });
    
    // Clear prescription validation error if it exists
    if (validationErrors.prescriptions) {
      setValidationErrors(prev => ({
        ...prev,
        prescriptions: null
      }));
    }
  };

  // Filter patients based on search term
  const filteredPatients = patients.filter(
    (patient) =>
      (patient.name || patient.first_name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter reports based on search term - no longer filtering by status
  const filteredReports = reports.filter((report) => {
    return report.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.type?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Pagination calculations for patients only
  const indexOfLastPatient = currentPatientPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);
  const totalPatientPages = Math.ceil(filteredPatients.length / patientsPerPage);

  // Handle page changes
  const handlePatientPageChange = (pageNumber) => {
    setCurrentPatientPage(pageNumber);
  };

  // Generate random color based on name (for patient avatars)
  const getAvatarColor = (name) => {
    if (!name) return 'bg-teal-500';
    
    const colors = [
      'bg-gradient-to-br from-teal-400 to-teal-600 dark:from-teal-500 dark:to-teal-700',
      'bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700',
      'bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700',
      'bg-gradient-to-br from-violet-400 to-violet-600 dark:from-violet-500 dark:to-violet-700',
      'bg-gradient-to-br from-purple-400 to-purple-600 dark:from-purple-500 dark:to-purple-700',
      'bg-gradient-to-br from-cyan-400 to-cyan-600 dark:from-cyan-500 dark:to-cyan-700',
      'bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700',
    ];
    
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return colors[hash % colors.length];
  };
  
  // Animation variants for Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.07,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } }
  };

  // Format for display in the UI
  const getReportFormatLabel = (format) => {
    return format?.toUpperCase() || "PDF";
  };

  // Debug info at top of page
  const debugInfo = (
    <div className="fixed top-0 left-0 z-50 bg-black/80 text-white text-xs p-2 max-w-sm overflow-auto" style={{ maxHeight: '200px' }}>
      <div>viewingPatient: {viewingPatient ? 'true' : 'false'}</div>
      <div>patients: {patients.length}</div>
      <div>cache: {patientsCacheRef.current.length}</div>
      <div>renderKey: {renderKey}</div>
      <div>isLoadingPatients: {isLoadingPatients ? 'true' : 'false'}</div>
      <pre>{filteredPatients.map(p => p.name || p.first_name).join(', ')}</pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-900 transition-colors duration-200 font-['Inter',system-ui,sans-serif]">
      {/* Uncomment for debugging 
      {debugInfo} 
      */}
      
      {/* Page container with top wave decoration */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-teal-500/10 via-blue-500/10 to-purple-500/10 dark:from-teal-900/20 dark:via-blue-900/20 dark:to-purple-900/20 overflow-hidden z-0">
        <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSIxNTAiIHZpZXdCb3g9IjAgMCAxNDQwIDE1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAwQzQwOC43IDAgNTQwLjcgMTUwIDcyMCAxNTBDOTAyLjUgMTUwIDEwMzIuMyAwIDE0NDAgMFYxNTBIMFYwWiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]"></div>
      </div>

      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 500, damping: 30 }}
            className="fixed top-4 right-4 z-50 bg-emerald-50 dark:bg-emerald-900/30 backdrop-blur-sm border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-4 shadow-xl shadow-emerald-200/10 dark:shadow-emerald-900/5 flex items-center transform transition-all duration-300 ease-in-out max-w-md"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center">
              <FiCheckCircle
                className="text-emerald-600 dark:text-emerald-400"
                size={20}
              />
            </div>
            <span className="mx-3 text-emerald-800 dark:text-emerald-200 font-medium flex-1">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 rounded-full p-1 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 transition-colors"
              aria-label="Dismiss"
            >
              <FiX size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message Toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 500, damping: 30 }}
            className="fixed top-4 right-4 z-50 bg-rose-50 dark:bg-rose-900/30 backdrop-blur-sm border border-rose-200 dark:border-rose-800/30 rounded-xl p-4 shadow-xl shadow-rose-200/10 dark:shadow-rose-900/5 flex items-center transform transition-all duration-300 ease-in-out max-w-md"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-rose-100 dark:bg-rose-800/50 flex items-center justify-center">
              <FiAlertCircle className="text-rose-600 dark:text-rose-400" size={20} />
            </div>
            <div className="mx-3 flex-1">
              <span className="text-rose-800 dark:text-rose-200 font-medium block">{errorMessage}</span>
              {errorDetails && (
                <div className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                  <p>Error Code: {errorDetails.error_code}</p>
                  <p>Timestamp: {new Date(errorDetails.timestamp).toLocaleString()}</p>
                </div>
              )}
              {debugResponse && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-rose-700 dark:text-rose-300">Debug Response</summary>
                  <pre className="mt-1 p-2 bg-rose-100 dark:bg-rose-900/50 rounded text-rose-800 dark:text-rose-200 overflow-auto max-h-40">
                    {JSON.stringify(debugResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <button
              onClick={() => {
                setErrorMessage("");
                setErrorDetails(null);
                setDebugResponse(null);
              }}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 rounded-full p-1 hover:bg-rose-100 dark:hover:bg-rose-800/50 transition-colors"
              aria-label="Dismiss"
            >
              <FiX size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirmation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden max-w-md w-full"
            >
              <div className="border-b border-gray-200 dark:border-slate-700 p-6 bg-gradient-to-r from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <FiTrash2 className="text-rose-500 dark:text-rose-400 mr-2" /> Delete Report
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setReportToDelete(null);
                      setDeletionReason("");
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full hover:bg-rose-200/50 dark:hover:bg-rose-800/30 transition-colors"
                    aria-label="Close"
                  >
                    <FiX className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
              
              <div className="p-6 dark:text-gray-100">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Are you sure you want to delete this medical report? This action cannot be undone.
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason for Deletion (Optional)
                  </label>
                  <textarea
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    placeholder="Specify reason for deletion"
                    className="block w-full border border-gray-300 dark:border-slate-600 rounded-xl shadow-sm py-2.5 px-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-600 transition-all duration-200"
                    rows={3}
                  ></textarea>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800/30 mb-6">
                  <div className="flex items-start">
                    <FiAlertCircle className="text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5 mr-2" size={16} />
                    <div className="text-sm text-amber-700 dark:text-amber-400">
                      <p>This will permanently delete the report from the system and notify relevant staff members.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-gray-200 dark:border-slate-700 p-4 flex justify-end space-x-3 bg-gray-50 dark:bg-slate-800/50">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowDeleteConfirmation(false);
                    setReportToDelete(null);
                    setDeletionReason("");
                  }}
                  className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                  disabled={isLoading}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteReport}
                  className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-sm font-medium shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 dark:focus:ring-offset-slate-800 transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Deleting...
                    </div>
                  ) : (
                    "Delete Report"
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        {viewingPatient ? (
          /* Patient's Medical Reports View */
          <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/70 dark:border-slate-700/50 overflow-hidden transition-all duration-200"
          >
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center">
                  <motion.button
                    whileHover={{ scale: 1.1, x: -2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleBackToPatients}
                    className="mr-4 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    aria-label="Back to patients"
                  >
                    <FiArrowLeft size={20} />
                  </motion.button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                      <span className="relative">
                      Previous Medical Reports
                        <span className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-teal-400 to-blue-500 dark:from-teal-500 dark:to-blue-600 w-full rounded"></span>
                      </span>
                    </h1>
                    <div className="flex items-center mt-1.5 text-gray-600 dark:text-gray-400">
                      <div className={`flex-shrink-0 h-9 w-9 rounded-full ${getAvatarColor(viewingPatient.name || viewingPatient.first_name)} flex items-center justify-center font-semibold mr-2 text-sm text-white shadow-sm`}>
                        {(viewingPatient.name || viewingPatient.first_name)
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || ""}
                      </div>
                      <span className="text-base font-medium text-gray-800 dark:text-gray-100">
                        {viewingPatient.name || viewingPatient.first_name}
                      </span>
                      <span className="mx-2 text-gray-400 dark:text-gray-600">•</span>
                      <span className="text-sm">{viewingPatient.age} y.o.</span>
                      <span className="mx-2 text-gray-400 dark:text-gray-600">•</span>
                      <span className="text-sm">{viewingPatient.gender}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial sm:w-64">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search reports..."
                      className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-base transition-all duration-200"
                      onChange={(e) => setSearchTerm(e.target.value)}
                      value={searchTerm}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white rounded-xl transition duration-200 shadow-md hover:shadow-lg font-medium"
                    onClick={() => {
                      setSelectedPatient(viewingPatient);
                      setNewReport((prev) => ({
                        ...prev,
                        patient_id: viewingPatient.id,
                        patientName: viewingPatient.name || viewingPatient.first_name,
                      }));
                      setShowReportForm(true);
                    }}
                  >
                    <FiPlus className="mr-2" />
                    New Report
                  </motion.button>
                </div>
              </div>
            </div>

            {isLoadingReports ? (
              <div className="flex justify-center py-16">
                <div className="flex flex-col items-center">
                  <div className="h-12 w-12 relative">
                    <div className="absolute top-0 left-0 right-0 bottom-0 border-4 border-teal-200/30 dark:border-teal-900/20 rounded-full"></div>
                    <div className="absolute top-0 left-0 right-0 bottom-0 border-4 border-t-4 border-teal-500 dark:border-teal-400 rounded-full animate-spin"></div>
                  </div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading reports...</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {filteredReports.length > 0 ? (
                  <>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                      <thead className="bg-gray-50 dark:bg-slate-800/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Format
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Created By
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700/70">
                        {filteredReports.map((report) => (
                          <motion.tr 
                            key={report.id} 
                            variants={itemVariants}
                            className="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors duration-150"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-3 py-1.5 inline-flex text-sm leading-5 font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                                {getReportFormatLabel(report.format_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {report.created_at ? (
                                <div className="flex items-center">
                                  <FiCalendar className="mr-1.5 text-gray-400 dark:text-gray-500" size={14} />
                                  {new Date(report.created_at).toLocaleDateString()}
                                  <span className="mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                                  <FiClock className="mr-1.5 text-gray-400 dark:text-gray-500" size={14} />
                                  {new Date(report.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                              ) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center">
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 dark:from-blue-600 dark:to-teal-600 flex items-center justify-center text-white font-medium text-xs shadow-sm mr-2">
                                  <FiUser size={12} />
                                </div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {report.doctor_name || 'Dr. ' + user.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-3">
                                <motion.button
                                  whileHover={{ scale: 1.15 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                  title="Download"
                                  onClick={() => handleDownloadReport(report.id)}
                                >
                                  <FiDownload className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.15 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                                  title="Delete"
                                  onClick={() => handleConfirmDelete(report.id)}
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center justify-center py-16 text-center px-6"
                  >
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-800 dark:to-blue-900/30 flex items-center justify-center mb-4 shadow-inner">
                      <FiFile className="w-12 h-12 text-blue-500 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No reports found</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                      {searchTerm 
                        ? `No reports match your search for "${searchTerm}".` 
                        : "There are no medical reports for this patient yet. Create your first report to get started."}
                    </p>
                    {searchTerm ? (
                      <button 
                        onClick={() => setSearchTerm("")}
                        className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium flex items-center"
                      >
                        <FiX className="mr-1.5" /> Clear search
                      </button>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white rounded-xl transition duration-200 shadow-md hover:shadow-lg font-medium"
                        onClick={() => {
                          setSelectedPatient(viewingPatient);
                          setNewReport((prev) => ({
                            ...prev,
                            patient_id: viewingPatient.id,
                            patientName: viewingPatient.name || viewingPatient.first_name,
                          }));
                          setShowReportForm(true);
                        }}
                      >
                        <FiPlus className="mr-2" />
                        Create Report
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          /* Patients List View */
          <motion.div
            key={`patients-list-view-${renderKey}`}
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/70 dark:border-slate-700/50 overflow-hidden transition-all duration-200"
          >
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-teal-50 via-sky-50 to-white dark:from-teal-900/20 dark:via-sky-900/10 dark:to-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  <FiActivity className="mr-2 text-teal-500 dark:text-teal-400" />
                  <span className="relative">
                    Medical Reports
                    <span className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-blue-500 dark:from-teal-500 dark:to-blue-600 rounded"></span>
                  </span>
                </h1>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial sm:w-64">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search patients..."
                      className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-base transition-all duration-200 shadow-sm"
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPatientPage(1); // Reset to first page on search
                      }}
                      value={searchTerm}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <FiX size={16} />
                      </button>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white rounded-xl transition duration-200 shadow-md hover:shadow-lg font-medium whitespace-nowrap"
                    onClick={() => setShowReportForm(true)}
                  >
                    <FiPlus className="mr-2" />
                    New Report
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-2 border-b border-gray-200 dark:border-slate-700/30">
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleManualRefresh}
                disabled={isLoadingPatients || isFetchingRef.current}
                className="inline-flex items-center py-1.5 px-3 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                {isLoadingPatients ? (
                  <>
                    <div className="h-4 w-4 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <FiRefreshCw className="mr-1.5" size={14} /> Refresh List
                  </>
                )}
              </motion.button>
            </div>

            {isLoadingPatients ? (
              <div className="flex justify-center py-16">
                <div className="flex flex-col items-center">
                  <div className="h-12 w-12 relative">
                    <div className="absolute top-0 left-0 right-0 bottom-0 border-4 border-teal-200/30 dark:border-teal-900/20 rounded-full"></div>
                    <div className="absolute top-0 left-0 right-0 bottom-0 border-4 border-t-4 border-teal-500 dark:border-teal-400 rounded-full animate-spin"></div>
                  </div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading patients...</p>
                </div>
              </div>
            ) : (
              <div>
                {patients.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-4" ref={patientListRef}>
                      {currentPatients.map((patient, i) => (
                        <motion.div
                          key={patient.id}
                          custom={i}
                          initial="hidden"
                          animate={controls}
                          variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: (i) => ({
                              opacity: 1,
                              y: 0,
                              transition: { delay: i * 0.05, duration: 0.4 }
                            })
                          }}
                          whileHover={{ y: -6, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
                          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-xl overflow-hidden transition-all duration-300 cursor-pointer group"
                          onClick={() => handleViewPatientReports(patient)}
                        >
                          <div className="h-3 bg-gradient-to-r from-teal-400 to-blue-500 dark:from-teal-500 dark:to-blue-600 transform origin-left transition-all duration-300 ease-in-out group-hover:scale-x-105"></div>
                          <div className="p-4 flex items-center gap-3 border-b border-gray-100 dark:border-slate-700/50">
                            <div className={`flex-shrink-0 h-12 w-12 rounded-lg ${getAvatarColor(patient.name || patient.first_name)} flex items-center justify-center text-lg font-semibold text-white shadow-md transition-transform duration-300 group-hover:scale-110`}>
                              {(patient.name || patient.first_name)
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || ""}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate">
                                {patient.name || patient.first_name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                                  {patient.id?.substring(0, 6)}...
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Age</span>
                                <span className="font-medium text-gray-900 dark:text-white">{patient.age} years</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Gender</span>
                                <span className="font-medium text-gray-900 dark:text-white">{patient.gender}</span>
                              </div>
                            </div>
                            
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewPatientReports(patient);
                              }}
                              className="w-full py-2 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors text-sm font-medium border border-teal-100 dark:border-teal-900/30 flex items-center justify-center"
                            >
                              <FiFile className="mr-1.5" size={14} /> View Medical Reports
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    
                    {/* Pagination for Patients */}
                    {totalPatientPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-center">
                        <nav className="flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                          <motion.button
                            whileHover={currentPatientPage !== 1 ? { scale: 1.05 } : {}}
                            whileTap={currentPatientPage !== 1 ? { scale: 0.95 } : {}}
                            onClick={() => handlePatientPageChange(currentPatientPage - 1)}
                            disabled={currentPatientPage === 1}
                            className={`px-3.5 py-2 border-r border-gray-200 dark:border-slate-700 ${
                              currentPatientPage === 1
                                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                            }`}
                            aria-label="Previous page"
                          >
                            <FiChevronLeft size={18} />
                          </motion.button>
                          
                          {Array.from({ length: totalPatientPages }, (_, i) => i + 1).map((page) => (
                            <motion.button
                              key={`patient-page-${page}`}
                              whileHover={currentPatientPage !== page ? { scale: 1.05 } : {}}
                              whileTap={currentPatientPage !== page ? { scale: 0.95 } : {}}
                              onClick={() => handlePatientPageChange(page)}
                              className={`px-4 py-2 text-sm ${
                                currentPatientPage === page
                                  ? "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium"
                                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                              }`}
                            >
                              {page}
                            </motion.button>
                          ))}
                          
                          <motion.button
                            whileHover={currentPatientPage !== totalPatientPages ? { scale: 1.05 } : {}}
                            whileTap={currentPatientPage !== totalPatientPages ? { scale: 0.95 } : {}}
                            onClick={() => handlePatientPageChange(currentPatientPage + 1)}
                            disabled={currentPatientPage === totalPatientPages}
                            className={`px-3.5 py-2 border-l border-gray-200 dark:border-slate-700 ${
                              currentPatientPage === totalPatientPages
                                ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                            }`}
                            aria-label="Next page"
                          >
                            <FiChevronRight size={18} />
                          </motion.button>
                        </nav>
                      </div>
                    )}
                  </>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center justify-center py-16 text-center px-6"
                  >
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-800 dark:to-blue-900/30 flex items-center justify-center mb-4 shadow-inner">
                      <FiUser className="w-12 h-12 text-blue-500 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No patients found</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                      {searchTerm ? 
                        `No patients match your search for "${searchTerm}".` : 
                        `No patients are available yet. (Cache: ${patientsCacheRef.current.length})`}
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      {searchTerm && (
                        <motion.button 
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSearchTerm("")}
                          className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium flex items-center justify-center border border-teal-200 dark:border-teal-800/30 px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-900/20"
                        >
                          <FiX className="mr-1.5" /> Clear search
                        </motion.button>
                      )}
                      
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleManualRefresh}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center justify-center border border-blue-200 dark:border-blue-800/30 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20"
                      >
                        <FiRefreshCw className="mr-1.5" /> Refresh Patients List
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Select Patient Modal */}
        <AnimatePresence>
          {showReportForm && !selectedPatient && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 overflow-y-auto bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="border-b border-gray-200 dark:border-slate-700 p-6 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                      <FiUser className="mr-2 text-teal-600 dark:text-teal-400" /> Select Patient
                    </h2>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowReportForm(false)}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full hover:bg-teal-200/50 dark:hover:bg-teal-800/30 transition-colors"
                      aria-label="Close"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-6">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search by name or ID..."
                        className="pl-10 pr-4 py-2.5 w-full border border-gray-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-base transition-all duration-200"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        value={searchTerm}
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <FiX size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isLoadingPatients ? (
                    <div className="flex justify-center py-8">
                      <div className="h-8 w-8 relative">
                        <div className="absolute top-0 left-0 right-0 bottom-0 border-3 border-teal-200/30 dark:border-teal-900/20 rounded-full"></div>
                        <div className="absolute top-0 left-0 right-0 bottom-0 border-3 border-t-3 border-teal-500 dark:border-teal-400 rounded-full animate-spin"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {patients.length > 0 ? (
                        <>
                          {patients
                            .filter(
                              (patient) =>
                                (patient.name || patient.first_name)
                                  ?.toLowerCase()
                                  .includes(searchTerm.toLowerCase()) ||
                                patient.id
                                  ?.toLowerCase()
                                  .includes(searchTerm.toLowerCase())
                            )
                            .map((patient) => (
                              <motion.div
                                key={patient.id}
                                whileHover={{ y: -2, backgroundColor: "rgba(240, 253, 250, 0.5)" }}
                                whileTap={{ scale: 0.98 }}
                                className="p-4 mb-2 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 cursor-pointer transition-all hover:border-teal-200 dark:hover:border-teal-700 hover:shadow-sm"
                                onClick={() => handleSelectPatient(patient)}
                              >
                                <div className="flex items-center">
                                  <div className={`w-10 h-10 rounded-lg ${getAvatarColor(patient.name || patient.first_name)} flex items-center justify-center text-white font-semibold text-base shadow-sm mr-3`}>
                                    {(patient.name || patient.first_name)
                                      ?.split(" ")
                                      .map((n) => n[0])
                                      .join("") || ""}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">
                                      {patient.name || patient.first_name}
                                    </p>
                                    <div className="flex flex-wrap items-center mt-1 gap-2">
                                      <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-mono">
                                        ID: {patient.id?.substring(0, 8)}...
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {patient.age} years
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {patient.gender}
                                      </span>
                                    </div>
                                  </div>
                                  <motion.div 
                                    className="text-gray-400 dark:text-gray-600"
                                    animate={{ x: [0, 5, 0] }}
                                    transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                                  >
                                    <FiChevronRight />
                                  </motion.div>
                                </div>
                              </motion.div>
                            ))}

                          {patients.filter(
                            (patient) =>
                              (patient.name || patient.first_name)
                                ?.toLowerCase()
                                .includes(searchTerm.toLowerCase()) ||
                              patient.id?.toLowerCase().includes(searchTerm.toLowerCase())
                          ).length === 0 && (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-700">
                              <FiSearch className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                              <p>No patients found matching your search.</p>
                              {searchTerm && (
                                <button 
                                  onClick={() => setSearchTerm("")}
                                  className="mt-3 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium flex items-center mx-auto"
                                >
                                  <FiX className="mr-1.5" /> Clear search
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-700">
                          <FiUser className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                          <p>No patients available.</p>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleManualRefresh}
                            className="mt-3 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center mx-auto px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/30 bg-blue-50 dark:bg-blue-900/20"
                          >
                            <FiRefreshCw className="mr-1.5" size={14} /> Refresh List
                          </motion.button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-slate-700 p-4 flex justify-end bg-gray-50 dark:bg-slate-800/50">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowReportForm(false)}
                    className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Report Form Modal */}
        <AnimatePresence>
          {showReportForm && selectedPatient && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 overflow-y-auto bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
              >
                <div className="border-b border-gray-200 dark:border-slate-700 p-6 bg-gradient-to-r from-teal-50 via-blue-50 to-indigo-50 dark:from-teal-900/20 dark:via-blue-900/20 dark:to-indigo-900/20">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                      <FiFile className="mr-2 text-teal-600 dark:text-teal-400" /> Generate Medical Report
                    </h2>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setShowReportForm(false);
                        setSelectedPatient(null);
                      }}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full hover:bg-teal-200/50 dark:hover:bg-teal-800/30 transition-colors"
                      aria-label="Close"
                    >
                      <FiX className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-6 flex-grow">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl mb-6 border border-blue-100 dark:border-blue-900/30 flex items-center">
                    <div className={`flex-shrink-0 h-14 w-14 rounded-lg ${getAvatarColor(selectedPatient.name || selectedPatient.first_name)} flex items-center justify-center text-lg font-semibold text-white shadow-md mr-4 transition-transform duration-300 hover:scale-110`}>
                      {(selectedPatient.name || selectedPatient.first_name)
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("") || ""}
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-gray-900 dark:text-white">
                        {selectedPatient.name || selectedPatient.first_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-sm text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-md text-xs">
                          ID: {selectedPatient.id?.substring(0, 8)}...
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedPatient.age} years
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedPatient.gender}
                        </span>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitReport}>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label
                            htmlFor="type"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Report Type
                          </label>
                          <div className="relative">
                            <select
                              id="type"
                              name="type"
                              value={newReport.type}
                              onChange={handleInputChange}
                              className="block w-full border border-gray-300 dark:border-slate-600 rounded-xl shadow-sm py-2.5 px-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 appearance-none"
                            >
                              <option value="Consultation">Consultation Note</option>
                              <option value="Lab Results">
                                Lab Results Interpretation
                              </option>
                              <option value="Surgical">Surgical Report</option>
                              <option value="Discharge Summary">Discharge Summary</option>
                              <option value="Follow-up">Follow-up Note</option>
                              <option value="Prescription">Prescription</option>
                              <option value="Referral">Referral Letter</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
                              <FiChevronDown />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Report Format
                          </label>
                          <div className="flex space-x-4 mt-2">
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="formatPdf"
                                name="format_type"
                                value="pdf"
                                checked={newReport.format_type === "pdf"}
                                onChange={handleInputChange}
                                className="h-4 w-4 border-gray-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
                              />
                              <label
                                htmlFor="formatPdf"
                                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                              >
                                PDF Document
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="formatCsv"
                                name="format_type"
                                value="csv"
                                checked={newReport.format_type === "csv"}
                                onChange={handleInputChange}
                                className="h-4 w-4 border-gray-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
                              />
                              <label
                                htmlFor="formatCsv"
                                className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                              >
                                CSV Format
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="observations"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            Clinical Findings
                          </label>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Optional</span>
                        </div>
                        <textarea
                          id="observations"
                          name="observations"
                          rows={4}
                          value={newReport.observations}
                          onChange={handleInputChange}
                          className="block w-full border border-gray-300 dark:border-slate-600 rounded-xl shadow-sm py-2.5 px-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                          placeholder="Describe physical examination findings, lab results, imaging findings, etc."
                        ></textarea>
                      </div>

                      <div className="bg-gradient-to-r from-gray-50 to-gray-50 dark:from-slate-700/30 dark:to-slate-700/30 p-5 rounded-xl border border-gray-200 dark:border-slate-700">
                        <div className="mb-4">
                          <label
                            htmlFor="diagnosis"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center"
                          >
                            Diagnosis <span className="text-rose-500 dark:text-rose-400 ml-1">*</span>
                          </label>
                          <textarea
                            id="diagnosis"
                            name="diagnosis"
                            rows={2}
                            value={newReport.diagnosis}
                            onChange={handleInputChange}
                            className={`block w-full border ${
                              validationErrors.diagnosis 
                                ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500 dark:border-rose-500" 
                                : "border-gray-300 dark:border-slate-600 focus:ring-teal-500 focus:border-teal-500"
                            } rounded-xl shadow-sm py-2.5 px-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all duration-200`}
                            placeholder="Primary and differential diagnoses"
                          ></textarea>
                          {validationErrors.diagnosis && (
                            <p className="mt-1.5 text-sm text-rose-500 dark:text-rose-400 flex items-center">
                              <FiAlertCircle className="mr-1.5" size={14} />
                              {validationErrors.diagnosis}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="treatment"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center"
                          >
                            Treatment Plan <span className="text-rose-500 dark:text-rose-400 ml-1">*</span>
                          </label>
                          <textarea
                            id="treatment"
                            name="treatment"
                            rows={3}
                            value={newReport.treatment}
                            onChange={handleInputChange}
                            className={`block w-full border ${
                              validationErrors.treatment 
                                ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500 dark:border-rose-500" 
                                : "border-gray-300 dark:border-slate-600 focus:ring-teal-500 focus:border-teal-500"
                            } rounded-xl shadow-sm py-2.5 px-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all duration-200`}
                            placeholder="Medications, procedures, therapies, etc."
                          ></textarea>
                          {validationErrors.treatment && (
                            <p className="mt-1.5 text-sm text-rose-500 dark:text-rose-400 flex items-center">
                              <FiAlertCircle className="mr-1.5" size={14} />
                              {validationErrors.treatment}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="recommendations"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            Recommendations
                          </label>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Optional</span>
                        </div>
                        <textarea
                          id="recommendations"
                          name="recommendations"
                          rows={2}
                          value={newReport.recommendations}
                          onChange={handleInputChange}
                          className="block w-full border border-gray-300 dark:border-slate-600 rounded-xl shadow-sm py-2.5 px-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                          placeholder="Follow-up instructions, referrals, lifestyle modifications, etc."
                        ></textarea>
                      </div>

                      <div className="bg-gradient-to-r from-gray-50 to-gray-50 dark:from-slate-700/30 dark:to-slate-700/30 p-5 rounded-xl border border-gray-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-3">
                          <label
                            htmlFor="prescriptions"
                            className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center"
                          >
                            Prescriptions <span className="text-rose-500 dark:text-rose-400 ml-1">*</span>
                          </label>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={addPrescription}
                            className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center font-medium"
                          >
                            <FiPlus className="mr-1" size={16} /> Add Prescription
                          </motion.button>
                        </div>
                        
                        <div className="space-y-3">
                          {newReport.prescriptions.map((prescription, index) => (
                            <div key={index} className="flex group">
                              <input
                                type="text"
                                value={prescription}
                                onChange={(e) => handlePrescriptionChange(index, e.target.value)}
                                className={`block w-full border ${
                                  validationErrors.prescriptions 
                                    ? "border-rose-500 focus:ring-rose-500 focus:border-rose-500 dark:border-rose-500" 
                                    : "border-gray-300 dark:border-slate-600 focus:ring-teal-500 focus:border-teal-500"
                                } rounded-xl shadow-sm py-2.5 px-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all duration-200`}
                                placeholder="Enter prescription details"
                              />
                              {newReport.prescriptions.length > 1 && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  type="button"
                                  onClick={() => removePrescription(index)}
                                  className="ml-2 p-2 text-gray-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                  aria-label="Remove prescription"
                                >
                                  <FiX size={18} />
                                </motion.button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {validationErrors.prescriptions && (
                          <p className="mt-1.5 text-sm text-rose-500 dark:text-rose-400 flex items-center">
                            <FiAlertCircle className="mr-1.5" size={14} />
                            {validationErrors.prescriptions}
                          </p>
                        )}
                        
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-start">
                          <FiInfo className="mr-1.5 mt-0.5" size={12} />
                          Enter at least one prescription, or "None" if no medications are prescribed.
                        </p>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="border-t border-gray-200 dark:border-slate-700 p-6 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl flex justify-end space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => {
                      setShowReportForm(false);
                      setSelectedPatient(null);
                      setValidationErrors({});
                    }}
                    className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    disabled={isLoading}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    onClick={handleSubmitReport}
                    className="px-6 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 dark:focus:ring-offset-slate-800 transition-all duration-200"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Generating...
                      </div>
                    ) : (
                      "Generate Report"
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
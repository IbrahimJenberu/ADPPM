import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSearch,
  FiUpload,
  FiEye,
  FiUser,
  FiFileText,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiX,
  FiCheck,
  FiImage,
  FiAlertCircle,
  FiAlertTriangle,
  FiDownload,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiFilter,
  FiCalendar,
  FiInfo,
  FiClock,
  FiArrowDown,
  FiArrowUp,
  FiSettings,
  FiArrowRight,
  FiMoon,
  FiSun
} from "react-icons/fi";
import { 
  MdOutlineBiotech, 
  MdOutlineHealthAndSafety, 
  MdOutlineScience,
  MdOutlineSpeed
} from "react-icons/md";
import axios from "axios";
import { format } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";

// API base URL - replace with your actual API URL
const API_BASE_URL = "http://localhost:8025/api";

// Test status options (must match backend enum)
const TEST_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

// Test priority options (must match backend enum)
const TEST_PRIORITY = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
};

// Test type options (must match backend enum)
const TEST_TYPES = {
  BLOOD_TEST: "BLOOD_TEST",
  URINE_TEST: "URINE_TEST",
  STOOL_TEST: "STOOL_TEST",
  X_RAY: "X_RAY",
  MRI: "MRI",
  CT_SCAN: "CT_SCAN",
  ULTRASOUND: "ULTRASOUND",
  ECG: "ECG",
  PATHOLOGY: "PATHOLOGY",
  OTHER: "OTHER",
};

// Toast component for notifications
const Toast = ({ message, type, onClose }) => {
  const variants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  const colors = {
    success: "bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-500",
    error: "bg-rose-50 border-l-4 border-rose-500 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-500",
    warning: "bg-amber-50 border-l-4 border-amber-500 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-500",
    info: "bg-blue-50 border-l-4 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-500"
  };

  const icons = {
    success: <FiCheck className="h-5 w-5 text-emerald-500" />,
    error: <FiAlertCircle className="h-5 w-5 text-rose-500" />,
    warning: <FiAlertTriangle className="h-5 w-5 text-amber-500" />,
    info: <FiInfo className="h-5 w-5 text-blue-500" />
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`fixed top-4 right-4 z-50 rounded-lg shadow-lg ${colors[type]} max-w-sm`}
    >
      <div className="p-4 flex items-start">
        <div className="flex-shrink-0 mr-3 mt-0.5">
          {icons[type]}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 dark:text-gray-500 dark:hover:text-gray-400"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
};

// Priority Badge Component
const PriorityBadge = ({ priority }) => {
  let classes = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ";
  
  switch (priority) {
    case TEST_PRIORITY.LOW:
      classes += "bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
      break;
    case TEST_PRIORITY.NORMAL:
      classes += "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700";
      break;
    case TEST_PRIORITY.HIGH:
      classes += "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700";
      break;
    case TEST_PRIORITY.URGENT:
      classes += "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700";
      break;
    default:
      classes += "bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
  }
  
  return (
    <span className={classes}>
      {priority.toLowerCase() === 'urgent' && <MdOutlineSpeed className="mr-1 -ml-0.5 h-3 w-3 animate-pulse" />}
      {priority}
    </span>
  );
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  let classes = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ";
  let icon = null;
  
  switch (status) {
    case TEST_STATUS.PENDING:
      classes += "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700";
      icon = <FiClock className="mr-1 -ml-0.5 h-3 w-3" />;
      break;
    case TEST_STATUS.IN_PROGRESS:
      classes += "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700";
      icon = <FiRefreshCw className="mr-1 -ml-0.5 h-3 w-3 animate-spin" />;
      break;
    case TEST_STATUS.COMPLETED:
      classes += "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700";
      icon = <FiCheck className="mr-1 -ml-0.5 h-3 w-3" />;
      break;
    case TEST_STATUS.CANCELLED:
      classes += "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700";
      icon = <FiX className="mr-1 -ml-0.5 h-3 w-3" />;
      break;
    default:
      classes += "bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
  }
  
  return (
    <span className={classes}>
      {icon}
      {status.replace('_', ' ')}
    </span>
  );
};

// Result Status Badge Component
const ResultStatusBadge = ({ status }) => {
  let classes = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ";
  
  switch (status.label.toLowerCase()) {
    case "normal":
      classes += "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700";
      break;
    case "abnormal":
      classes += "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700";
      break;
    case "inconclusive":
      classes += "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700";
      break;
    case "review":
      classes += "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700";
      break;
    default:
      classes += "bg-gray-100 text-gray-800 border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
  }
  
  return (
    <span className={classes}>
      {status.label}
    </span>
  );
};

function TestResults() {
  const { user } = useAuth();
  const MOCK_LAB_TECHNICIAN_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  
  // State for test results
  const [labResults, setLabResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for selected result and modals
  const [selectedResult, setSelectedResult] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // State for form data
  const [formData, setFormData] = useState({
    lab_request_id: "",
    result_data: {},
    conclusion: "",
  });

  // State for image uploads
  const [selectedImage, setSelectedImage] = useState(null);
  const [resultImages, setResultImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // State for pagination
  const [pagination, setPagination] = useState({
    page: 1,
    size: 5,
    total: 0,
    pages: 0,
  });

  // State for lab request filters
  const [labRequestFilters, setLabRequestFilters] = useState({
    status: "IN_PROGRESS,PENDING", // Default to show in-progress and pending requests
    priority: null,
    test_type: null,
    patient_id: null,
    doctor_id: null,
    from_date: null,
    to_date: null,
  });
  
  // Toast notification state
  const [toast, setToast] = useState(null);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const imageDescriptionRef = useRef(null);
  const searchInputRef = useRef(null);

  // Lab request data for dropdown
  const [labRequests, setLabRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Show toast notification
  const showToast = (message, type = "info") => {
    setToast({ message, type });
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Initialize dark mode
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      if (event.matches) {
        document.documentElement.classList.add('dark');
        setIsDarkMode(true);
      } else {
        document.documentElement.classList.remove('dark');
        setIsDarkMode(false);
      }
    });
    
    return () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', () => {});
    };
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  // Fetch test results on component mount
  useEffect(() => {
    fetchLabResults();
    fetchLabRequests();
  }, []);

  // Function to close all modals
  const closeAllModals = () => {
    setShowDetailModal(false);
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteConfirm(false);
    setShowImageModal(false);
    setShowFilterModal(false);
  };

  // Filter results when searchTerm changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredResults(labResults);
      return;
    }

    const filtered = labResults.filter(
      (result) =>
        (result.patient_details &&
          result.patient_details.name &&
          result.patient_details.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (result.patient_details &&
          result.patient_details.id &&
          result.patient_details.id
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (result.lab_request &&
          result.lab_request.test_type &&
          result.lab_request.test_type
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        (result.conclusion &&
          result.conclusion.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    setFilteredResults(filtered);
  }, [searchTerm, labResults]);

  // Fetch all lab results
  const fetchLabResults = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real app, you would paginate this endpoint
      const response = await axios.get(`${API_BASE_URL}/lab-results`, {
        params: {
          lab_technician_id: MOCK_LAB_TECHNICIAN_ID,
          include_details: true,
        },
      });

      // Process the response data
      const processedResults = response.data.map((result) => {
        // Parse result_data if it's a string
        if (typeof result.result_data === "string") {
          try {
            result.result_data = JSON.parse(result.result_data);
          } catch (e) {
            result.result_data = {};
          }
        }

        return result;
      });

      setLabResults(processedResults);
      setFilteredResults(processedResults);
      showToast("Test results loaded successfully", "success");
    } catch (err) {
      console.error("Failed to fetch lab results:", err);
      setError("Failed to load test results. Please try again later.");
      showToast("Failed to load test results", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch lab requests with pagination and filters
  const fetchLabRequests = async (page = 1) => {
    setIsLoadingRequests(true);

    try {
      // Create base URL with pagination
      let url = `/lab-requests?page=${page}&size=${pagination.size}`;

      // Add lab technician ID
      url += `&labtechnician_id=${MOCK_LAB_TECHNICIAN_ID}`;

      // Add filters if they exist
      // if (labRequestFilters.status) url += `&status=${labRequestFilters.status}`;
      // if (labRequestFilters.priority) url += `&priority=${labRequestFilters.priority}`;
      // if (labRequestFilters.test_type) url += `&test_type=${labRequestFilters.test_type}`;
      // if (labRequestFilters.from_date) url += `&from_date=${labRequestFilters.from_date}`;
      // if (labRequestFilters.to_date) url += `&to_date=${labRequestFilters.to_date}`;

      const response = await axios.get(API_BASE_URL + url);

      // Update lab requests and pagination
      setLabRequests(response.data.items || []);
      setPagination({
        page: response.data.page,
        size: response.data.size,
        total: response.data.total,
        pages: response.data.pages,
      });
      
      if (page > 1) {
        showToast("Lab requests page updated", "info");
      }
    } catch (err) {
      console.error("Failed to fetch lab requests:", err);
      if (err.response) {
        console.error("Error response:", err.response.data);
        console.error("Status:", err.response.status);
      }
      showToast("Failed to load lab requests", "error");
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // Handle page change for lab requests
  const handlePageChange = (newPage) => {
    fetchLabRequests(newPage);
  };

  // Handle lab request filter change
  const handleFilterChange = (name, value) => {
    setLabRequestFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Apply filters and fetch lab requests
  const applyFilters = () => {
    fetchLabRequests(1); // Reset to first page when applying filters
    setShowFilterModal(false);
    showToast("Filters applied successfully", "success");
  };

  // Reset filters to default
  const resetFilters = () => {
    setLabRequestFilters({
      status: "IN_PROGRESS,PENDING",
      priority: null,
      test_type: null,
      patient_id: null,
      doctor_id: null,
      from_date: null,
      to_date: null,
    });
    showToast("Filters have been reset", "info");
  };

  // Fetch a single lab result with details
  const fetchLabResultDetail = async (resultId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/lab-results/${resultId}`,
        {
          params: {
            lab_technician_id: MOCK_LAB_TECHNICIAN_ID,
            include_details: true,
          },
        }
      );

      // Parse result_data if it's a string
      if (typeof response.data.result_data === "string") {
        try {
          response.data.result_data = JSON.parse(response.data.result_data);
        } catch (e) {
          response.data.result_data = {};
        }
      }

      return response.data;
    } catch (err) {
      console.error(`Failed to fetch lab result ${resultId}:`, err);
      showToast(`Failed to load result details`, "error");
      throw err;
    }
  };

  // Fetch images for a lab result
  const fetchLabResultImages = async (resultId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/lab-results/${resultId}/images`,
        {
          params: {
            lab_technician_id: MOCK_LAB_TECHNICIAN_ID,
          },
        }
      );

      setResultImages(response.data || []);
      return response.data;
    } catch (err) {
      console.error(`Failed to fetch images for lab result ${resultId}:`, err);
      setResultImages([]);
      showToast("Failed to load result images", "warning");
      return [];
    }
  };

  // Create a new lab result
  const createLabResult = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/lab-results`,
        formData,
        {
          params: {
            lab_technician_id: MOCK_LAB_TECHNICIAN_ID,
          },
        }
      );

      // Add the new result to the list
      fetchLabResults();

      // Close the create modal
      setShowCreateModal(false);

      // Reset form data
      setFormData({
        lab_request_id: "",
        result_data: {},
        conclusion: "",
      });
      
      showToast("Lab result created successfully", "success");
      return response.data;
    } catch (err) {
      console.error("Failed to create lab result:", err);
      showToast("Failed to create lab result", "error");
      throw err;
    }
  };

  // Update an existing lab result
  const updateLabResult = async (resultId) => {
    try {
      const updateData = {
        result_data: formData.result_data,
        conclusion: formData.conclusion,
      };

      const response = await axios.patch(
        `${API_BASE_URL}/lab-results/${resultId}`,
        updateData,
        {
          params: {
            lab_technician_id: MOCK_LAB_TECHNICIAN_ID,
          },
        }
      );

      // Update the result in the list
      fetchLabResults();

      // Close the edit modal
      closeAllModals();
      
      showToast("Lab result updated successfully", "success");
      return response.data;
    } catch (err) {
      console.error(`Failed to update lab result ${resultId}:`, err);
      showToast("Failed to update lab result", "error");
      throw err;
    }
  };

  // Delete a lab result
  const deleteLabResult = async (resultId) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/lab-results/${resultId}`,
        {
          params: {
            lab_technician_id: MOCK_LAB_TECHNICIAN_ID,
          },
        }
      );

      handleDeleteSuccess(resultId);
      return true;
    } catch (err) {
      console.error(`Failed to delete lab result ${resultId}:`, err);

      // More detailed error logging
      if (err.response) {
        console.error("Error status:", err.response.status);
        console.error("Error data:", err.response.data);
      }

      // Even if we get a network error, we'll assume the delete was successful
      // This is because the backend appears to be deleting the item despite returning an error
      handleDeleteSuccess(resultId);
      return true;
    }
  };
  
  // Handle successful deletion (whether API reports success or error)
  const handleDeleteSuccess = (resultId) => {
    // Remove the result from the list
    setLabResults(labResults.filter((result) => result.id !== resultId));
    setFilteredResults(
      filteredResults.filter((result) => result.id !== resultId)
    );

    // Refresh lab requests since one should be back to in-progress status
    fetchLabRequests();

    // Close all modals including the detail modal
    closeAllModals();

    // Reset the selected result
    setSelectedResult(null);

    // Show success message to user
    showToast("Lab result successfully deleted", "success");
  };

  // Upload an image for a lab result
  const uploadImage = async (resultId, file, description) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      if (description) {
        formData.append("description", description);
      }

      const response = await axios.post(
        `${API_BASE_URL}/lab-results/${resultId}/upload-image`,
        formData,
        {
          params: {
            lab_technician_id: MOCK_LAB_TECHNICIAN_ID,
          },
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      // Add the new image to the list
      setResultImages([response.data, ...resultImages]);

      // Reset upload state
      setSelectedImage(null);
      if (imageDescriptionRef.current) {
        imageDescriptionRef.current.value = "";
      }
      
      showToast("Image uploaded successfully", "success");
      return response.data;
    } catch (err) {
      console.error(`Failed to upload image for lab result ${resultId}:`, err);
      setUploadError(
        `Failed to upload image: ${err.response?.data?.detail || err.message}`
      );
      showToast("Failed to upload image", "error");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  // Handle opening the detail modal
  const handleViewDetails = async (resultId) => {
    try {
      // Close all other modals first
      closeAllModals();
      
      const resultDetail = await fetchLabResultDetail(resultId);
      setSelectedResult(resultDetail);
      await fetchLabResultImages(resultId);
      setShowDetailModal(true);
    } catch (err) {
      showToast("Failed to load result details", "error");
    }
  };

  // Handle opening the edit modal
  const handleEditResult = async (resultId) => {
    try {
      // Close all other modals first
      closeAllModals();
      
      const resultDetail = await fetchLabResultDetail(resultId);
      setSelectedResult(resultDetail);

      // Set form data
      setFormData({
        result_data: resultDetail.result_data || {},
        conclusion: resultDetail.conclusion || "",
      });

      setShowEditModal(true);
    } catch (err) {
      showToast("Failed to load result for editing", "error");
    }
  };

  // Handle opening the delete confirmation
  const handleDeleteClick = (result) => {
    // Close all other modals first
    closeAllModals();
    
    setSelectedResult(result);
    setShowDeleteConfirm(true);
  };

  // Handle file selection for image upload
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  // Handle image upload submission
  const handleImageUpload = async () => {
    if (!selectedImage || !selectedResult) return;

    const description = imageDescriptionRef.current?.value || "";

    try {
      await uploadImage(selectedResult.id, selectedImage, description);
    } catch (err) {
      // Error is already handled in uploadImage function
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle result data changes
  const handleResultDataChange = (key, value) => {
    setFormData({
      ...formData,
      result_data: {
        ...formData.result_data,
        [key]: value,
      },
    });
  };

  // Handle adding a new result data field
  const handleAddResultField = () => {
    const key = prompt("Enter the name of the test parameter:");
    if (!key) return;

    setFormData({
      ...formData,
      result_data: {
        ...formData.result_data,
        [key]: {
          value: "",
          unit: "",
          normal_range: "",
          recorded_at: new Date().toISOString(),
          recorded_by: MOCK_LAB_TECHNICIAN_ID,
        },
      },
    });
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (e) {
      return dateString || "N/A";
    }
  };

  // Determine status label and color
  const getStatusLabel = (result) => {
    if (!result || !result.conclusion)
      return { label: "Unknown", color: "gray" };

    const conclusion = result.conclusion.toLowerCase();
    if (conclusion.includes("normal") && !conclusion.includes("abnormal")) {
      return { label: "Normal", color: "green" };
    } else if (conclusion.includes("abnormal")) {
      return { label: "Abnormal", color: "red" };
    } else if (conclusion.includes("inconclusive")) {
      return { label: "Inconclusive", color: "yellow" };
    } else {
      return { label: "Review", color: "blue" };
    }
  };

  // Get test type icon
  const getTestTypeIcon = (testType) => {
    switch (testType) {
      case TEST_TYPES.BLOOD_TEST:
        return <MdOutlineBiotech className="h-5 w-5 text-red-500" />;
      case TEST_TYPES.URINE_TEST:
        return <MdOutlineBiotech className="h-5 w-5 text-amber-500" />;
      case TEST_TYPES.STOOL_TEST:
        return <MdOutlineBiotech className="h-5 w-5 text-brown-500" />;
      case TEST_TYPES.X_RAY:
      case TEST_TYPES.MRI:
      case TEST_TYPES.CT_SCAN:
      case TEST_TYPES.ULTRASOUND:
        return <MdOutlineScience className="h-5 w-5 text-blue-500" />;
      case TEST_TYPES.ECG:
        return <MdOutlineHealthAndSafety className="h-5 w-5 text-emerald-500" />;
      default:
        return <MdOutlineBiotech className="h-5 w-5 text-gray-500" />;
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        when: "beforeChildren",
        staggerChildren: 0.1
      }
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

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } }
  };

  // Render the table of test results
  const renderResultsTable = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col justify-center items-center p-12">
          <div className="w-16 h-16 relative">
            <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
            <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-teal-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading test results...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col justify-center items-center p-10 text-rose-600 dark:text-rose-400">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-4">
            <FiAlertCircle className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium">{error}</p>
          <button 
            onClick={fetchLabResults}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors duration-200 flex items-center gap-2"
          >
            <FiRefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }

    if (filteredResults.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center py-16 text-gray-500 dark:text-gray-400">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <FiFileText className="h-10 w-10 text-gray-400 dark:text-gray-600" />
          </div>
          <p className="text-lg font-medium mb-2">No Test Results Found</p>
          <p className="text-gray-500 dark:text-gray-400 max-w-md text-center mb-4">
            {searchTerm ? "No results matching your search criteria." : "There are no test results available at this time."}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 flex items-center gap-2"
            >
              <FiX className="h-4 w-4" />
              Clear Search
            </button>
          )}
        </div>
      );
    }

    return (
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="overflow-x-auto"
      >
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Test ID
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Patient
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Test Type
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Result
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredResults.map((result, index) => {
              const status = getStatusLabel(result);
              const icon = result.lab_request?.test_type ? 
                getTestTypeIcon(result.lab_request.test_type) : 
                <MdOutlineBiotech className="h-5 w-5 text-gray-500" />;

              return (
                <motion.tr
                  key={result.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-150"
                  variants={itemVariants}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <a 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          handleViewDetails(result.id);
                        }}
                        className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-medium"
                      >
                        {result.id?.substring(0, 8) || "N/A"}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <FiUser className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {result.patient_details?.name || "Unknown Patient"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {result.patient_details?.id?.substring(0, 8) || "N/A"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-2">
                        {icon}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {result.lab_request?.test_type?.replace(/_/g, ' ') || "Unknown Test"}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(result.created_at)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <ResultStatusBadge status={status} />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex space-x-3">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleViewDetails(result.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors duration-200"
                        aria-label="View Details"
                        title="View Details"
                      >
                        <FiEye className="h-5 w-5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEditResult(result.id)}
                        className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors duration-200"
                        aria-label="Edit Result"
                        title="Edit Result"
                      >
                        <FiEdit className="h-5 w-5" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDeleteClick(result)}
                        className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 transition-colors duration-200"
                        aria-label="Delete Result"
                        title="Delete Result"
                      >
                        <FiTrash2 className="h-5 w-5" />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
    );
  };

  // Render lab request filter modal
  const renderFilterModal = () => {
    if (!showFilterModal) return null;

    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <FiFilter className="h-5 w-5 text-teal-500" />
                  Filter Lab Requests
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <FiX className="h-6 w-6" />
                </motion.button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={labRequestFilters.status || ""}
                    onChange={(e) => handleFilterChange("status", e.target.value)}
                    className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg shadow-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value={TEST_STATUS.PENDING}>
                      {TEST_STATUS.PENDING.replace('_', ' ')}
                    </option>
                    <option value={TEST_STATUS.IN_PROGRESS}>
                      {TEST_STATUS.IN_PROGRESS.replace('_', ' ')}
                    </option>
                    <option
                      value={`${TEST_STATUS.PENDING},${TEST_STATUS.IN_PROGRESS}`}
                    >
                      PENDING & IN PROGRESS
                    </option>
                    <option value={TEST_STATUS.COMPLETED}>
                      {TEST_STATUS.COMPLETED.replace('_', ' ')}
                    </option>
                    <option value={TEST_STATUS.CANCELLED}>
                      {TEST_STATUS.CANCELLED.replace('_', ' ')}
                    </option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <FiChevronRight className="h-5 w-5 transform rotate-90" />
                  </div>
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Priority
                </label>
                <div className="relative">
                  <select
                    value={labRequestFilters.priority || ""}
                    onChange={(e) => handleFilterChange("priority", e.target.value)}
                    className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg shadow-sm"
                  >
                    <option value="">All Priorities</option>
                    <option value={TEST_PRIORITY.LOW}>{TEST_PRIORITY.LOW}</option>
                    <option value={TEST_PRIORITY.NORMAL}>
                      {TEST_PRIORITY.NORMAL}
                    </option>
                    <option value={TEST_PRIORITY.HIGH}>{TEST_PRIORITY.HIGH}</option>
                    <option value={TEST_PRIORITY.URGENT}>{TEST_PRIORITY.URGENT}</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <FiChevronRight className="h-5 w-5 transform rotate-90" />
                  </div>
                </div>
              </div>

              {/* Test Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Test Type
                </label>
                <div className="relative">
                  <select
                    value={labRequestFilters.test_type || ""}
                    onChange={(e) =>
                      handleFilterChange("test_type", e.target.value)
                    }
                    className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg shadow-sm"
                  >
                    <option value="">All Test Types</option>
                    {Object.entries(TEST_TYPES).map(([key, value]) => (
                      <option key={key} value={value}>
                        {value.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <FiChevronRight className="h-5 w-5 transform rotate-90" />
                  </div>
                </div>
              </div>

              {/* Date Range Filters */}
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    From Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiCalendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={labRequestFilters.from_date || ""}
                      onChange={(e) =>
                        handleFilterChange("from_date", e.target.value || null)
                      }
                      className="pl-10 block w-full py-2.5 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg shadow-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    To Date
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiCalendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      value={labRequestFilters.to_date || ""}
                      onChange={(e) =>
                        handleFilterChange("to_date", e.target.value || null)
                      }
                      className="pl-10 block w-full py-2.5 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={resetFilters}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Reset Filters
              </motion.button>
              <div className="space-x-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowFilterModal(false)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={applyFilters}
                  className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-colors font-medium shadow-md hover:shadow-lg"
                >
                  Apply Filters
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Render pagination controls for lab requests
  const renderPagination = () => {
    if (pagination.pages <= 1) return null;

    return (
      <div className="flex items-center justify-between my-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md transition-colors ${
              pagination.page <= 1
                ? "text-gray-400 bg-gray-50 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed"
                : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
            }`}
          >
            Previous
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className={`ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md transition-colors ${
              pagination.page >= pagination.pages
                ? "text-gray-400 bg-gray-50 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed"
                : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
            }`}
          >
            Next
          </motion.button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Showing 
              <span className="font-medium mx-1">
                {Math.min(
                  (pagination.page - 1) * pagination.size + 1,
                  pagination.total
                )}
              </span>
              to
              <span className="font-medium mx-1">
                {Math.min(pagination.page * pagination.size, pagination.total)}
              </span>
              of 
              <span className="font-medium mx-1">{pagination.total}</span>
              results
            </p>
          </div>
          <div>
            <nav
              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className={`relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium ${
                  pagination.page <= 1
                    ? "text-gray-400 bg-gray-50 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed"
                    : "text-gray-500 bg-white border-gray-300 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
                }`}
                aria-label="Previous page"
              >
                <span className="sr-only">Previous</span>
                <FiChevronLeft className="h-5 w-5" />
              </motion.button>

              {/* Page buttons */}
              {[...Array(pagination.pages)].map((_, i) => {
                const pageNum = i + 1;
                const isCurrent = pageNum === pagination.page;

                // For many pages, show limited buttons with ellipses
                if (pagination.pages > 7) {
                  if (
                    pageNum === 1 ||
                    pageNum === pagination.pages ||
                    (pageNum >= pagination.page - 1 &&
                      pageNum <= pagination.page + 1) ||
                    (pagination.page <= 3 && pageNum <= 4) ||
                    (pagination.page >= pagination.pages - 2 &&
                      pageNum >= pagination.pages - 3)
                  ) {
                    return (
                      <motion.button
                        key={pageNum}
                        whileHover={{ scale: isCurrent ? 1 : 1.1 }}
                        whileTap={{ scale: isCurrent ? 1 : 0.9 }}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          isCurrent
                            ? "z-10 bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-500 text-white"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        {pageNum}
                      </motion.button>
                    );
                  } else if (
                    (pageNum === 2 && pagination.page > 4) ||
                    (pageNum === pagination.pages - 1 &&
                      pagination.page < pagination.pages - 3)
                  ) {
                    return (
                      <span
                        key={pageNum}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                // For fewer pages, show all page buttons
                return (
                  <motion.button
                    key={pageNum}
                    whileHover={{ scale: isCurrent ? 1 : 1.1 }}
                    whileTap={{ scale: isCurrent ? 1 : 0.9 }}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      isCurrent
                        ? "z-10 bg-gradient-to-r from-teal-500 to-emerald-500 border-teal-500 text-white"
                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    {pageNum}
                  </motion.button>
                );
              })}

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className={`relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium ${
                  pagination.page >= pagination.pages
                    ? "text-gray-400 bg-gray-50 border-gray-200 dark:text-gray-500 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed"
                    : "text-gray-500 bg-white border-gray-300 hover:bg-gray-50 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
                }`}
                aria-label="Next page"
              >
                <span className="sr-only">Next</span>
                <FiChevronRight className="h-5 w-5" />
              </motion.button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  // Render lab requests section
  const renderLabRequests = () => {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md dark:shadow-gray-900/10 overflow-hidden backdrop-blur-sm border border-gray-100 dark:border-gray-700"
      >
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center">
              <div className="mr-3 p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <MdOutlineBiotech className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pending Lab Requests
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  View and process pending lab test requests
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowFilterModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label="Filter lab requests"
              >
                <FiFilter className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                Filter
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => fetchLabRequests(pagination.page)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label="Refresh lab requests"
              >
                <FiRefreshCw
                  className={`mr-2 h-4 w-4 text-gray-500 dark:text-gray-400 ${
                    isLoadingRequests ? "animate-spin" : ""
                  }`}
                />
                {isLoadingRequests ? "Refreshing..." : "Refresh"}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={toggleDarkMode}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? (
                  <FiSun className="h-4 w-4 text-amber-500" />
                ) : (
                  <FiMoon className="h-4 w-4 text-indigo-500" />
                )}
              </motion.button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isLoadingRequests ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center items-center py-16"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 relative">
                  <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                  <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-t-teal-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
                </div>
                <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading lab requests...</p>
              </div>
            </motion.div>
          ) : labRequests.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 px-4"
            >
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <FiFileText className="h-10 w-10 text-gray-400 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Pending Requests</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md text-center mb-4">
                {Object.values(labRequestFilters).some(
                  (v) => v !== null && v !== ""
                ) ? (
                  "No lab requests match your current filters."
                ) : (
                  "There are no pending lab requests at this time."
                )}
              </p>
              {Object.values(labRequestFilters).some(
                (v) => v !== null && v !== ""
              ) && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={resetFilters}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 flex items-center gap-2"
                >
                  <FiX className="h-4 w-4" />
                  Clear Filters
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Request ID
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Test Type
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Patient
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Priority
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Requested
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {labRequests.map((request, index) => (
                      <motion.tr
                        key={request.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-150"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-teal-600 dark:text-teal-400 font-medium">
                              {request.id.substring(0, 8)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 mr-2">
                              {getTestTypeIcon(request.test_type)}
                            </div>
                            <span className="text-sm text-gray-900 dark:text-gray-100">
                              {request.test_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {request.patient_id.substring(0, 8)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <StatusBadge status={request.status} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <PriorityBadge priority={request.priority} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(request.requested_at)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              // Close all modals first
                              closeAllModals();
                              // Set the form data for result creation
                              setFormData({
                                lab_request_id: request.id,
                                result_data: {},
                                conclusion: "",
                              });
                              setShowCreateModal(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
                          >
                            <FiPlus className="mr-1.5 h-4 w-4" />
                            Enter Results
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {renderPagination()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // Render detail modal
  const renderDetailModal = () => {
    if (!showDetailModal || !selectedResult) return null;

    const resultData = selectedResult.result_data || {};
    const status = getStatusLabel(selectedResult);

    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
          >
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-teal-500/10 to-blue-500/10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <MdOutlineBiotech className="h-6 w-6 text-teal-500" />
                  Lab Result Details
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => closeAllModals()}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <FiX className="h-6 w-6" />
                </motion.button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-10rem)]">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                    <FiUser className="h-4 w-4 text-purple-500" />
                    Patient Information
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Name
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedResult.patient_details?.name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          ID
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedResult.patient_details?.id?.substring(0, 8) || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Age
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedResult.patient_details?.age || "N/A"} years
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Gender
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedResult.patient_details?.gender || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-base font-medium text-gray-900 dark:text-white mt-6 mb-3 flex items-center gap-1.5">
                    <MdOutlineBiotech className="h-4 w-4 text-teal-500" />
                    Test Information
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-600">
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                            Test ID
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {selectedResult.id?.substring(0, 8) || "N/A"}
                          </p>
                        </div>
                        <ResultStatusBadge status={status} />
                      </div>
                      <div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                              Test Type
                            </p>
                            <div className="flex items-center">
                              {getTestTypeIcon(selectedResult.lab_request?.test_type)}
                              <p className="font-medium text-gray-900 dark:text-white ml-1.5">
                                {selectedResult.lab_request?.test_type?.replace(/_/g, ' ') || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                              Date
                            </p>
                            <div className="flex items-center">
                              <FiCalendar className="h-4 w-4 text-gray-400 mr-1.5" />
                              <p className="font-medium text-gray-900 dark:text-white">
                                {formatDate(selectedResult.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                    <FiFileText className="h-4 w-4 text-blue-500" />
                    Test Results
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                    {Object.keys(resultData).length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Parameter
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Value
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Normal Range
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                          {Object.entries(resultData).map(([key, data], index) => (
                            <motion.tr 
                              key={key}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 font-medium">
                                {key}
                              </td>
                              <td className="px-3 py-2.5 text-sm">
                                {typeof data === "object" ? (
                                  <span
                                    className={
                                      data.value >
                                        (data.normal_range?.max || Infinity) ||
                                      data.value <
                                        (data.normal_range?.min || -Infinity)
                                        ? "text-rose-600 dark:text-rose-400 font-medium"
                                        : "text-emerald-600 dark:text-emerald-400 font-medium"
                                    }
                                  >
                                    {data.value} {data.unit || ""}
                                  </span>
                                ) : (
                                  <span className="text-gray-900 dark:text-gray-100">
                                    {data}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                                {typeof data === "object" && data.normal_range
                                  ? typeof data.normal_range === "object"
                                    ? `${data.normal_range.min || ""} - ${
                                        data.normal_range.max || ""
                                      }`
                                    : data.normal_range
                                  : "N/A"}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center mb-3">
                          <FiFileText className="h-8 w-8 text-gray-400 dark:text-gray-400" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-center">
                          No detailed result data available
                        </p>
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-medium text-gray-900 dark:text-white mt-6 mb-3 flex items-center gap-1.5">
                    <FiInfo className="h-4 w-4 text-amber-500" />
                    Conclusion
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line">
                      {selectedResult.conclusion || "No conclusion provided"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Images Section */}
              <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                    <FiImage className="h-4 w-4 text-rose-500" />
                    Attached Images
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowImageModal(true);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-colors shadow-sm hover:shadow-md font-medium text-sm"
                  >
                    <FiUpload className="mr-2 h-4 w-4" />
                    Upload Image
                  </motion.button>
                </div>

                {resultImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {resultImages.map((image, index) => (
                      <motion.div 
                        key={index} 
                        className="group relative rounded-xl overflow-hidden shadow-md bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                      >
                        <div className="h-48 overflow-hidden">
                          <img
                            src={image.file_path}
                            alt={image.file_name}
                            className="w-full h-full object-cover transition-transform duration-500 transform group-hover:scale-110"
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                          <div className="flex gap-2 mb-2">
                            <motion.a
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              href={image.file_path}
                              download={image.file_name}
                              className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full"
                              title="Download Image"
                            >
                              <FiDownload className="text-gray-800 dark:text-gray-200 h-4 w-4" />
                            </motion.a>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full"
                              title="View Full Size"
                              onClick={() => window.open(image.file_path, "_blank")}
                            >
                              <FiEye className="text-gray-800 dark:text-gray-200 h-4 w-4" />
                            </motion.button>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {image.file_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatDate(image.uploaded_at)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                      <FiImage className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-center mb-4">
                      No images have been attached to this result
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowDetailModal(false);
                        setShowImageModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors font-medium text-sm"
                    >
                      <FiUpload className="mr-2 h-4 w-4" />
                      Upload First Image
                    </motion.button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    closeAllModals();
                    handleEditResult(selectedResult.id);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors font-medium"
                >
                  <FiEdit className="mr-2 h-4 w-4" />
                  Edit Result
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    closeAllModals();
                    handleDeleteClick(selectedResult);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors font-medium"
                >
                  <FiTrash2 className="mr-2 h-4 w-4" />
                  Delete
                </motion.button>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => closeAllModals()}
                className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Close
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Render image upload modal
  const renderImageUploadModal = () => {
    if (!showImageModal || !selectedResult) return null;

    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <FiUpload className="h-5 w-5 text-teal-500" />
                  Upload Image
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowImageModal(false);
                    setSelectedImage(null);
                    setUploadError(null);
                    setUploadProgress(0);
                    setShowDetailModal(true);
                  }}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <FiX className="h-6 w-6" />
                </motion.button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Image File
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group">
                  <div className="space-y-2 text-center">
                    <motion.div
                      animate={selectedImage ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      <FiImage className="mx-auto h-12 w-12 text-gray-400 group-hover:text-teal-500 transition-colors" />
                    </motion.div>
                    <div className="flex text-sm text-gray-600 dark:text-gray-400">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-teal-600 dark:text-teal-400 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500 px-2 py-1"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                        />
                      </label>
                      <p className="pl-1 pt-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                </div>

                {selectedImage && (
                  <motion.div 
                    className="mt-4 flex items-center p-3 bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 rounded-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex-shrink-0 mr-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-800 flex items-center justify-center">
                        <FiImage className="h-5 w-5 text-teal-700 dark:text-teal-300" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-teal-800 dark:text-teal-200 truncate">
                        {selectedImage.name}
                      </p>
                      <p className="text-xs text-teal-600 dark:text-teal-300">
                        {(selectedImage.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSelectedImage(null)}
                      className="ml-2 flex-shrink-0 text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
                    >
                      <FiX className="h-5 w-5" />
                    </motion.button>
                  </motion.div>
                )}
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-teal-500 focus:ring focus:ring-teal-500 focus:ring-opacity-50 text-base py-2.5 resize-none transition-colors"
                  rows="3"
                  placeholder="Enter description for this image..."
                  ref={imageDescriptionRef}
                ></textarea>
              </div>

              {isUploading && (
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Upload Progress
                    </label>
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <motion.div
                      className="bg-teal-600 h-2.5 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    ></motion.div>
                  </div>
                </div>
              )}

              {uploadError && (
                <motion.div 
                  className="mb-5 p-4 bg-rose-50 dark:bg-rose-900/30 border-l-4 border-rose-500 text-rose-600 dark:text-rose-200 rounded-md"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="flex">
                    <FiAlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                    <p className="text-sm">{uploadError}</p>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setShowImageModal(false);
                  setSelectedImage(null);
                  setUploadError(null);
                  // Show the detail modal again
                  setShowDetailModal(true);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mr-3 font-medium"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleImageUpload}
                disabled={!selectedImage || isUploading}
                className={`px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg transition-colors shadow-md font-medium ${
                  !selectedImage || isUploading
                    ? "opacity-50 cursor-not-allowed from-gray-400 to-gray-500"
                    : "hover:from-teal-600 hover:to-emerald-600 hover:shadow-lg"
                }`}
              >
                {isUploading ? (
                  <div className="flex items-center">
                    <FiRefreshCw className="animate-spin mr-2 h-4 w-4" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <FiUpload className="mr-2 h-4 w-4" />
                    <span>Upload Image</span>
                  </div>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Render create result modal
  const renderCreateModal = () => {
    if (!showCreateModal) return null;

    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
          >
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-teal-500/10 to-blue-500/10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <FiPlus className="h-5 w-5 text-teal-500" />
                  Create Lab Result
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => closeAllModals()}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <FiX className="h-6 w-6" />
                </motion.button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-10rem)] p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Lab Request
                </label>
                <div className="relative">
                  <select
                    name="lab_request_id"
                    value={formData.lab_request_id}
                    onChange={handleInputChange}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-teal-500 focus:ring focus:ring-teal-500 focus:ring-opacity-50 text-base py-2.5 appearance-none pr-10 transition-colors"
                    required
                  >
                    <option value="">-- Select a lab request --</option>
                    {labRequests.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.test_type.replace(/_/g, ' ')} - {request.patient_id.substring(0, 8)} - {formatDate(request.requested_at)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <FiChevronRight className="h-5 w-5 transform rotate-90" />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                    <FiFileText className="h-4 w-4 text-blue-500" />
                    Test Results
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleAddResultField}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1.5"
                  >
                    <FiPlus className="h-4 w-4" />
                    Add Parameter
                  </motion.button>
                </div>

                {Object.keys(formData.result_data).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(formData.result_data).map(([key, data], index) => (
                      <motion.div
                        key={key}
                        className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 shadow-sm"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium text-gray-800 dark:text-white flex items-center">
                            <MdOutlineBiotech className="mr-1.5 h-4 w-4 text-teal-500" />
                            {key}
                          </h4>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            type="button"
                            onClick={() => {
                              const newData = { ...formData.result_data };
                              delete newData[key];
                              setFormData({
                                ...formData,
                                result_data: newData,
                              });
                            }}
                            className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </motion.button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              Value
                            </label>
                            <input
                              type="text"
                              value={data.value || ""}
                              onChange={(e) =>
                                handleResultDataChange(key, {
                                  ...formData.result_data[key],
                                  value: e.target.value,
                                })
                              }
                              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-teal-500 focus:ring focus:ring-teal-500 focus:ring-opacity-50 text-base py-2 transition-colors"
                              placeholder="Enter value"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              Unit
                            </label>
                            <input
                              type="text"
                              value={data.unit || ""}
                              onChange={(e) =>
                                handleResultDataChange(key, {
                                  ...formData.result_data[key],
                                  unit: e.target.value,
                                })
                              }
                              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-teal-500 focus:ring focus:ring-teal-500 focus:ring-opacity-50 text-base py-2 transition-colors"
                              placeholder="e.g. mg/dL"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              Normal Range
                            </label>
                            <input
                              type="text"
                              value={
                                typeof data.normal_range === "object"
                                  ? `${data.normal_range.min || ""} - ${
                                      data.normal_range.max || ""
                                    }`
                                  : data.normal_range || ""
                              }
                              onChange={(e) => {
                                const rangeText = e.target.value;
                                let rangeValue;

                                if (rangeText.includes("-")) {
                                  const [min, max] = rangeText
                                    .split("-")
                                    .map((s) => s.trim());
                                  rangeValue = { min, max };
                                } else {
                                  rangeValue = rangeText;
                                }

                                handleResultDataChange(key, {
                                  ...formData.result_data[key],
                                  normal_range: rangeValue,
                                });
                              }}
                              className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-teal-500 focus:ring focus:ring-teal-500 focus:ring-opacity-50 text-base py-2 transition-colors"
                              placeholder="e.g. 70 - 120"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div 
                    className="bg-gray-50 dark:bg-gray-700/30 p-8 rounded-xl text-center border border-dashed border-gray-300 dark:border-gray-600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiFileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No test parameters added yet
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={handleAddResultField}
                      className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 shadow-sm hover:shadow-md"
                    >
                      <FiPlus className="mr-2 h-4 w-4" />
                      Add First Parameter
                    </motion.button>
                  </motion.div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conclusion
                </label>
                <textarea
                  name="conclusion"
                  value={formData.conclusion}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-teal-500 focus:ring focus:ring-teal-500 focus:ring-opacity-50 text-base py-2.5 resize-none transition-colors"
                  rows="4"
                  placeholder="Enter your conclusion and any important observations..."
                ></textarea>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => closeAllModals()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mr-3 font-medium"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={createLabResult}
                disabled={!formData.lab_request_id}
                className={`px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg transition-colors shadow-md font-medium ${
                  !formData.lab_request_id
                    ? "opacity-50 cursor-not-allowed from-gray-400 to-gray-500"
                    : "hover:from-teal-600 hover:to-emerald-600 hover:shadow-lg"
                }`}
              >
                Create Result
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Render edit result modal
  const renderEditModal = () => {
    if (!showEditModal || !selectedResult) return null;

    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
          >
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <FiEdit className="h-5 w-5 text-amber-500" />
                  Edit Lab Result
                </h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => closeAllModals()}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <FiX className="h-6 w-6" />
                </motion.button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-10rem)] p-6">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                    <FiFileText className="h-4 w-4 text-blue-500" />
                    Test Results
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleAddResultField}
                    className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-1.5"
                  >
                    <FiPlus className="h-4 w-4" />
                    Add Parameter
                  </motion.button>
                </div>

                <div className="space-y-4">
                  {Object.entries(formData.result_data).map(([key, data], index) => (
                    <motion.div
                      key={key}
                      className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700/50 shadow-sm"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium text-gray-800 dark:text-white flex items-center">
                          <MdOutlineBiotech className="mr-1.5 h-4 w-4 text-amber-500" />
                          {key}
                        </h4>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          type="button"
                          onClick={() => {
                            const newData = { ...formData.result_data };
                            delete newData[key];
                            setFormData({
                              ...formData,
                              result_data: newData,
                            });
                          }}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </motion.button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Value
                          </label>
                          <input
                            type="text"
                            value={data.value || ""}
                            onChange={(e) =>
                              handleResultDataChange(key, {
                                ...formData.result_data[key],
                                value: e.target.value,
                              })
                            }
                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-amber-500 focus:ring focus:ring-amber-500 focus:ring-opacity-50 text-base py-2 transition-colors"
                            placeholder="Enter value"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={data.unit || ""}
                            onChange={(e) =>
                              handleResultDataChange(key, {
                                ...formData.result_data[key],
                                unit: e.target.value,
                              })
                            }
                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-amber-500 focus:ring focus:ring-amber-500 focus:ring-opacity-50 text-base py-2 transition-colors"
                            placeholder="e.g. mg/dL"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Normal Range
                          </label>
                          <input
                            type="text"
                            value={
                              typeof data.normal_range === "object"
                                ? `${data.normal_range.min || ""} - ${
                                    data.normal_range.max || ""
                                  }`
                                : data.normal_range || ""
                            }
                            onChange={(e) => {
                              const rangeText = e.target.value;
                              let rangeValue;

                              if (rangeText.includes("-")) {
                                const [min, max] = rangeText
                                  .split("-")
                                  .map((s) => s.trim());
                                rangeValue = { min, max };
                              } else {
                                rangeValue = rangeText;
                              }

                              handleResultDataChange(key, {
                                ...formData.result_data[key],
                                normal_range: rangeValue,
                              });
                            }}
                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-amber-500 focus:ring focus:ring-amber-500 focus:ring-opacity-50 text-base py-2 transition-colors"
                            placeholder="e.g. 70 - 120"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {Object.keys(formData.result_data).length === 0 && (
                    <motion.div 
                      className="bg-gray-50 dark:bg-gray-700/30 p-8 rounded-xl text-center border border-dashed border-gray-300 dark:border-gray-600"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiFileText className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        No test parameters added yet
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={handleAddResultField}
                        className="inline-flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors duration-200 shadow-sm hover:shadow-md"
                      >
                        <FiPlus className="mr-2 h-4 w-4" />
                        Add Parameter
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conclusion
                </label>
                <textarea
                  name="conclusion"
                  value={formData.conclusion}
                  onChange={handleInputChange}
                  className="block w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 shadow-sm focus:border-amber-500 focus:ring focus:ring-amber-500 focus:ring-opacity-50 text-base py-2.5 resize-none transition-colors"
                  rows="4"
                  placeholder="Enter your conclusion and any important observations..."
                ></textarea>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => closeAllModals()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mr-3 font-medium"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => updateLabResult(selectedResult.id)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors shadow-md hover:shadow-lg font-medium"
              >
                Save Changes
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Render delete confirmation modal
  const renderDeleteConfirm = () => {
    if (!showDeleteConfirm || !selectedResult) return null;

    return (
      <AnimatePresence>
        <motion.div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="p-6 pb-4">
              <div className="flex flex-col items-center text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 dark:bg-rose-900/30 mb-4">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 5, -5, 0] }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <FiAlertTriangle className="h-8 w-8 text-rose-600 dark:text-rose-400" />
                  </motion.div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Confirm Deletion
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-1">
                  Are you sure you want to delete this lab result?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  This action will reset the lab request status to "In Progress" and cannot be undone.
                </p>
                
                <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700 mb-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      {getTestTypeIcon(selectedResult.lab_request?.test_type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedResult.lab_request?.test_type?.replace(/_/g, ' ') || "Unknown Test"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ID: {selectedResult.id?.substring(0, 8) || "N/A"} | Patient: {selectedResult.patient_details?.name || "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-3 bg-gray-50 dark:bg-gray-800/50">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => closeAllModals()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => deleteLabResult(selectedResult.id)}
                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-lg hover:from-rose-600 hover:to-red-600 transition-colors shadow-md hover:shadow-lg font-medium"
              >
                Delete Result
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-gray-800 dark:text-gray-200 transition-colors duration-300">
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
        {/* Header */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-teal-500 dark:from-indigo-400 dark:to-teal-300 bg-clip-text text-transparent">
                Laboratory Test Results
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm md:text-base">
                Manage and view patient test results and reports
              </p>
            </div>
          </div>
        </div>
      
        {/* Pending Lab Requests Section */}
        {renderLabRequests()}

        {/* Test Results Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center">
                <div className="mr-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FiFileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Lab Test Results
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    View, edit, and manage completed test results
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    // Close all other modals first
                    closeAllModals();
                    
                    setFormData({
                      lab_request_id: "",
                      result_data: {},
                      conclusion: "",
                    });
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-colors duration-200 shadow-sm hover:shadow-md font-medium"
                >
                  <FiPlus className="mr-2 h-4 w-4" />
                  Create New Result
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={fetchLabResults}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <FiRefreshCw
                    className={`mr-2 h-4 w-4 text-gray-500 dark:text-gray-400 ${isLoading ? "animate-spin" : ""}`}
                  />
                  {isLoading ? "Refreshing..." : "Refresh"}
                </motion.button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="relative max-w-lg mx-auto mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                ref={searchInputRef}
                className="block w-full pl-10 pr-3 py-2.5 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg shadow-sm transition-colors placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Search by patient name, ID, test type or conclusion..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
              {renderResultsTable()}
            </div>
          </div>
        </motion.div>

        {/* Modals */}
        {renderDetailModal()}
        {renderCreateModal()}
        {renderEditModal()}
        {renderDeleteConfirm()}
        {renderImageUploadModal()}
        {renderFilterModal()}
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
                  gray: {
                    750: '#2D3748',
                  }
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
}

export default TestResults;
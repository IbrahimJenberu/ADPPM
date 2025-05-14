import React, { useState, useEffect, useRef } from "react";
import {
  FiSearch,
  FiPlus,
  FiEye,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiDownload,
  FiUpload,
  FiMessageCircle,
  FiActivity,
  FiPieChart,
  FiChevronLeft,
  FiChevronRight,
  FiFile,
  FiSettings,
  FiArrowRight,
  FiRefreshCw,
  FiAlertTriangle,
  FiInfo,
} from "react-icons/fi";
import axios from "axios";
import { Chart } from "chart.js/auto";
import { format, parseISO } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "react-hot-toast";

export default function LabRequestsDashboard() {
  // States
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { user } = useAuth();

  // Data states
  const [labRequests, setLabRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  // Initialize metrics with default values to prevent undefined errors
  const [metrics, setMetrics] = useState({
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    urgent_pending: 0,
    today_new: 0,
  });
  const [currentRequest, setCurrentRequest] = useState(null);
  const [analyticsData, setAnalyticsData] = useState({
    status_counts: {},
    test_type_counts: [],
    urgency_counts: {},
    trend_data: [],
    date_range: { from: "", to: "" },
    average_turnaround_hours: 0,
  });
  const [patients, setPatients] = useState([]);
  const [testTypes, setTestTypes] = useState([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(7);
  const [totalRequests, setTotalRequests] = useState(0);
  const [filtersApplied, setFiltersApplied] = useState({});

  // Form states
  const [newLabRequest, setNewLabRequest] = useState({
    patient_id: "",
    test_type: "",
    urgency: "high",
    notes: "",
  });

  const [newComment, setNewComment] = useState({
    comment: "",
    is_private: false,
  });

  const [fileUpload, setFileUpload] = useState({
    file: null,
    description: "",
  });

  const [filters, setFilters] = useState({
    status: "",
    urgency: "",
    test_type: "",
    patient_id: "",
    patient_name: "",
    date_from: "",
    date_to: "",
  });

  const [sortParams, setSortParams] = useState({
    sort_by: "created_at",
    sort_order: "desc",
  });

  // Refs
  const statusChartRef = useRef(null);
  const typeChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const statusChartInstance = useRef(null);
  const typeChartInstance = useRef(null);
  const trendChartInstance = useRef(null);
  const fileInputRef = useRef(null);
  const networkCanvasRef = useRef(null);

  // Dark mode detection
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

  // Animated background effect
  useEffect(() => {
    const canvas = networkCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Set canvas dimensions
    const setCanvasDimensions = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);
    
    // Create nodes
    const nodeCount = 40;
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 3 + 1,
      vx: Math.random() * 1 - 0.5,
      vy: Math.random() * 1 - 0.5,
      opacity: Math.random() * 0.5 + 0.2
    }));
    
    // Animation function
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 180) {
            ctx.strokeStyle = isDarkMode 
              ? `rgba(110, 109, 255, ${0.12 * (1 - distance / 180)})`
              : `rgba(93, 92, 222, ${0.07 * (1 - distance / 180)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      
      // Update and draw nodes
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
        
        // Boundary check
        if (nodes[i].x < 0 || nodes[i].x > canvas.width) nodes[i].vx *= -1;
        if (nodes[i].y < 0 || nodes[i].y > canvas.height) nodes[i].vy *= -1;
        
        // Draw node
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, nodes[i].radius, 0, Math.PI * 2);
        ctx.fillStyle = isDarkMode 
          ? `rgba(126, 125, 255, ${nodes[i].opacity})`
          : `rgba(93, 92, 222, ${nodes[i].opacity})`;
        ctx.fill();
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', setCanvasDimensions);
    };
  }, []);

  // Effect to fetch lab requests
  useEffect(() => {
    fetchLabRequests(0, pageSize);
    fetchPatients();
    fetchAnalyticsData(); 
  }, []);

  // Effect to filter lab requests based on search term
  useEffect(() => {
    if (!labRequests.length) return;

    let filtered = [...labRequests];

    // Apply search filter - filters after just one character is entered
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.patient_name?.toLowerCase().includes(search) ||
          request.test_type?.toLowerCase().includes(search) ||
          request.id?.toString().toLowerCase().includes(search)
      );
    }

    setFilteredRequests(filtered);
  }, [labRequests, searchTerm]);

  // Analytics charts effect
  useEffect(() => {
    if (showAnalyticsModal && analyticsData) {
      renderAnalyticsCharts();
    }
  }, [showAnalyticsModal, analyticsData]);

  // Function to fetch lab requests
  const fetchLabRequests = async (
    page = 0,
    pageSize = 50,
    isInitialLoad = true
  ) => {
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setErrorMessage("");

    try {
      // Format dates properly if they exist
      const formattedDateFrom = filters.date_from
        ? new Date(filters.date_from).toISOString().split("T")[0]
        : undefined;
      const formattedDateTo = filters.date_to
        ? new Date(filters.date_to).toISOString().split("T")[0]
        : undefined;

      // Calculate skip based on pagination
      const skip = page * pageSize;

      const response = await axios.get("http://localhost:8024/lab-requests", {
        params: {
          doctor_id: user.id,
          status: filters.status || undefined,
          urgency: filters.urgency || undefined,
          test_type: filters.test_type || undefined,
          patient_id: filters.patient_id || undefined,
          patient_name: filters.patient_name || undefined,
          date_from: formattedDateFrom,
          date_to: formattedDateTo,
          sort_by: sortParams.sort_by || "created_at",
          sort_order: sortParams.sort_order || "desc",
          skip: skip,
          limit: pageSize,
        },
      });

      const data = response.data;

      // If loading more, append to existing requests
      if (!isInitialLoad && page > 0) {
        setLabRequests((prev) => [...prev, ...data.lab_requests]);
      } else {
        setLabRequests(data.lab_requests);
      }

      setMetrics(
        data.metrics || {
          pending: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
          urgent_pending: 0,
          today_new: 0,
        }
      );
      setTotalRequests(data.total || 0);
      setCurrentPage(page);
      setFiltersApplied(data.filters_applied || {});
      setIsLoading(false);
      setIsLoadingMore(false);
      
      toast.success('Lab requests updated successfully', {
        icon: '⚡',
        duration: 2000,
      });
    } catch (error) {
      console.error("Error fetching lab requests:", error);
      const errorMessage =
        error.response?.data?.detail ||
        "Failed to load lab requests. Please try again.";
      setErrorMessage(errorMessage);
      setIsLoading(false);
      setIsLoadingMore(false);
      
      toast.error('Failed to load lab requests', {
        duration: 3000,
      });
    }
  };

  // Function to fetch patients
  const fetchPatients = async () => {
    try {
      const response = await axios.get("http://localhost:8024/patients", {
        params: { doctor_id: user.id },
      });
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  // Function to set test types
  useEffect(() => {
    fetchLabRequests(0, pageSize);
    fetchPatients();
    // Use hardcoded test types
    setTestTypes([
      { key: "complete_blood_count", label: "Complete Blood Count" },
      {
        key: "comprehensive_metabolic_panel",
        label: "Comprehensive Metabolic Panel",
      },
      { key: "lipid_panel", label: "Lipid Panel" },
      { key: "liver_function_test", label: "Liver Function Test" },
      { key: "thyroid_panel", label: "Thyroid Panel" },
      { key: "urinalysis", label: "Urinalysis" },
      { key: "hba1c", label: "HBA1C" },
      { key: "chest_xray", label: "Chest X‑Ray" },
      { key: "ecg", label: "ECG" },
      { key: "covid19_test", label: "COVID‑19 Test" },
      { key: "allergy_test", label: "Allergy Test" },
      { key: "vitamin_d_test", label: "Vitamin D Test" },
    ]);
  }, []);

  // Function to fetch lab request details
  const fetchLabRequestDetails = async (requestId) => {
    try {
      const response = await axios.get(
        `http://localhost:8024/lab-requests/${requestId}`,
        {
          params: { doctor_id: user.id },
        }
      );

      setCurrentRequest(response.data.lab_request);
      setShowDetailModal(true);
    } catch (error) {
      console.error("Error fetching lab request details:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to load lab request details";
      toast.error(errorMessage);
    }
  };

  // Function to create a new lab request
  const handleSubmitRequest = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        `http://localhost:8024/lab-requests?doctor_id=${user.id}`,
        {
          patient_id: newLabRequest.patient_id,
          test_type: newLabRequest.test_type,
          urgency: newLabRequest.urgency,
          notes: newLabRequest.notes,
        }
      );

      // Refresh the lab requests list to include the new request
      await fetchLabRequests();

      // Close modal and reset form
      setShowRequestForm(false);
      setNewLabRequest({
        patient_id: "",
        test_type: "",
        urgency: "high",
        notes: "",
      });

      // Show success message
      toast.success(response.data.message || "Lab request created successfully");
    } catch (error) {
      console.error("Error creating lab request:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to create lab request";
      toast.error(errorMessage);
    }
  };

  // Function to add a comment
  const handleAddComment = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        `http://localhost:8024/lab-requests/${currentRequest.id}/comments`,
        {
          ...newComment,
          doctor_id: user.id,
        }
      );

      // Update the current request with new comment
      const newCommentData = response.data.comment;
      setCurrentRequest((prev) => ({
        ...prev,
        comments: [newCommentData, ...(prev.comments || [])],
      }));

      // Close modal and reset form
      setShowCommentModal(false);
      setNewComment({
        comment: "",
        is_private: false,
      });

      // Show success message
      toast.success(response.data.message || "Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to add comment";
      toast.error(errorMessage);
    }
  };

  // Function to handle file upload
  const handleFileUpload = async (e) => {
    e.preventDefault();

    if (!fileUpload.file) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      // Use FormData to upload the file
      const formData = new FormData();
      formData.append("file", fileUpload.file);
      formData.append("file_description", fileUpload.description || "");

      const response = await axios.post(
        `http://localhost:8024/lab-requests/${currentRequest.id}/files`,
        formData,
        {
          params: { doctor_id: user.id },
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // Update the current request with new file
      const newFile = response.data.file;
      setCurrentRequest((prev) => ({
        ...prev,
        files: [newFile, ...(prev.files || [])],
      }));

      // Update file count in the lab requests list
      setLabRequests((prev) =>
        prev.map((req) =>
          req.id === currentRequest.id
            ? { ...req, file_count: (req.file_count || 0) + 1 }
            : req
        )
      );

      // Close modal and reset form
      setShowUploadModal(false);
      setFileUpload({
        file: null,
        description: "",
      });

      // Show success message
      toast.success(response.data.message || "File uploaded successfully");
    } catch (error) {
      console.error("Error uploading file:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to upload file";
      toast.error(errorMessage);
    }
  };

  // Function to handle cancellation
  const handleCancelRequest = async (requestId) => {
    const reason = prompt("Please enter a reason for cancellation:");
    if (reason === null) return; // User cancelled the prompt

    try {
      const response = await axios.delete(
        `http://localhost:8024/lab-requests/${requestId}`,
        {
          params: {
            doctor_id: user.id,
            cancellation_reason: reason,
          },
        }
      );

      // Refresh the lab requests list
      await fetchLabRequests();

      // If detail modal is open for this request, update it
      if (currentRequest && currentRequest.id === requestId) {
        // Fetch the updated request details
        const detailResponse = await axios.get(
          `http://localhost:8024/lab-requests/${requestId}`,
          {
            params: { doctor_id: user.id },
          }
        );

        setCurrentRequest(detailResponse.data.lab_request);
      }

      // Show success message
      toast.success(response.data.message || "Lab request cancelled successfully");
    } catch (error) {
      console.error("Error cancelling lab request:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to cancel lab request";
      toast.error(errorMessage);
    }
  };

  // Function to update lab request
  const handleUpdateRequest = async (requestId, updateData) => {
    try {
      const response = await axios.patch(
        `http://localhost:8024/lab-requests/${requestId}`,
        updateData,
        {
          params: { doctor_id: user.id },
        }
      );

      // Refresh the lab requests list
      await fetchLabRequests();

      // If detail modal is open for this request, update it
      if (currentRequest && currentRequest.id === requestId) {
        // Fetch the updated request details to get all the latest data
        const detailResponse = await axios.get(
          `http://localhost:8024/lab-requests/${requestId}`,
          {
            params: { doctor_id: user.id },
          }
        );

        setCurrentRequest(detailResponse.data.lab_request);
      }

      // Show success message
      toast.success(response.data.message || "Lab request updated successfully");
    } catch (error) {
      console.error("Error updating lab request:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to update lab request";
      toast.error(errorMessage);
    }
  };

  // Function to fetch analytics data with fixed handling of null values
  const fetchAnalyticsData = async (showModal = false) => {
    try {
      const response = await axios.get(
        "http://localhost:8024/lab-requests/analytics/summary",
        {
          params: {
            doctor_id: user.id,
            date_from: filters.date_from || undefined,
            date_to: filters.date_to || undefined,
          },
        }
      );

      // Create default empty objects to ensure we never have null/undefined
      const defaultData = {
        status_counts: {},
        test_type_counts: [],
        urgency_counts: {},
        trend_data: [],
        date_range: { from: "", to: "" },
        average_turnaround_hours: 0,
      };

      // Safely merge the API response data
      const responseData = response.data || {};
      const safeData = {
        ...defaultData,
        status_counts: responseData.status_counts || {},
        test_type_counts: responseData.test_type_counts || [],
        urgency_counts: responseData.urgency_counts || {},
        trend_data: responseData.trend_data || [],
        date_range: responseData.date_range || { from: "", to: "" },
        average_turnaround_hours: responseData.average_turnaround_hours || 0,
      };

      setAnalyticsData(safeData);

      // Only show the modal if specifically requested
      if (showModal) {
        setShowAnalyticsModal(true);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      const errorMessage =
        error.response?.data?.detail || "Failed to load analytics data";
      toast.error(errorMessage);
    }
  };

  // Function to handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 0 || newPage >= Math.ceil(totalRequests / pageSize)) return;
    fetchLabRequests(newPage, pageSize, false);
  };

  // Helper function to safely calculate total from an object using Object.values
  const getSafeTotal = (obj) => {
    // Extra strict check to ensure obj is a non-null object
    if (!obj || typeof obj !== "object" || obj === null) return 0;
    try {
      return Object.values(obj).reduce(
        (sum, val) => sum + (Number(val) || 0),
        0
      );
    } catch (err) {
      console.error("Error calculating total:", err);
      return 0;
    }
  };

  // Helper function to safely calculate percentage
  const getSafePercentage = (value, total) => {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  };

  // Function to render analytics charts with robust error handling
  const renderAnalyticsCharts = () => {
    try {
      // Clean up any existing charts
      if (statusChartInstance.current) {
        statusChartInstance.current.destroy();
        statusChartInstance.current = null;
      }
      if (typeChartInstance.current) {
        typeChartInstance.current.destroy();
        typeChartInstance.current = null;
      }
      if (trendChartInstance.current) {
        trendChartInstance.current.destroy();
        trendChartInstance.current = null;
      }

      // Ensure we have valid refs before proceeding
      if (
        !statusChartRef.current ||
        !typeChartRef.current ||
        !trendChartRef.current
      ) {
        console.error("Chart references not available");
        return;
      }

      // Create safe references to analytics data to prevent errors with null/undefined
      const safeStatusCounts =
        analyticsData?.status_counts &&
        typeof analyticsData.status_counts === "object"
          ? analyticsData.status_counts
          : {};

      const safeTestTypeCounts = Array.isArray(analyticsData?.test_type_counts)
        ? analyticsData.test_type_counts
        : [];

      const safeUrgencyCounts =
        analyticsData?.urgency_counts &&
        typeof analyticsData.urgency_counts === "object"
          ? analyticsData.urgency_counts
          : {};

      const safeTrendData = Array.isArray(analyticsData?.trend_data)
        ? analyticsData.trend_data
        : [];

      // Use try/catch for each chart creation to ensure one failure doesn't block others
      try {
        // Make sure we have safe objects before using Object.keys/values
        const statusLabels = Object.keys(safeStatusCounts);
        const statusData = Object.values(safeStatusCounts);

        const statusColors = [
          "rgba(255, 205, 86, 0.8)", // pending - yellow
          "rgba(54, 162, 235, 0.8)", // in progress - blue
          "rgba(75, 192, 192, 0.8)", // completed - green
          "rgba(201, 203, 207, 0.8)", // cancelled - gray
          "rgba(255, 99, 132, 0.8)", // rejected - red
        ];

        statusChartInstance.current = new Chart(statusChartRef.current, {
          type: "pie",
          data: {
            labels: statusLabels.map(
              (s) => s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")
            ),
            datasets: [
              {
                data: statusData,
                backgroundColor: statusColors,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: "right" },
              title: {
                display: true,
                text: "Lab Requests by Status",
              },
            },
          },
        });
      } catch (chartError) {
        console.error("Error creating status chart:", chartError);
      }

      try {
        // Test types chart
        typeChartInstance.current = new Chart(typeChartRef.current, {
          type: "bar",
          data: {
            labels: safeTestTypeCounts.map((t) => t?.test_type || "Unknown"),
            datasets: [
              {
                label: "Number of Requests",
                data: safeTestTypeCounts.map((t) => t?.count || 0),
                backgroundColor: "rgba(93, 92, 222, 0.8)",
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: "Test Types Distribution",
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
              },
            },
          },
        });
      } catch (chartError) {
        console.error("Error creating test types chart:", chartError);
      }

      try {
        // Trend chart
        trendChartInstance.current = new Chart(trendChartRef.current, {
          type: "line",
          data: {
            labels: safeTrendData.map((t) =>
              t?.date ? format(parseISO(t.date), "MMM dd") : ""
            ),
            datasets: [
              {
                label: "Lab Requests",
                data: safeTrendData.map((t) => t?.count || 0),
                fill: false,
                borderColor: "rgb(93, 92, 222)",
                tension: 0.1,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: "Lab Requests Trend",
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
              },
            },
          },
        });
      } catch (chartError) {
        console.error("Error creating trend chart:", chartError);
      }
    } catch (error) {
      console.error("Error rendering analytics charts:", error);
    }
  };

  // Function to format date and time
  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return format(date, "MMM dd, yyyy h:mm a");
    } catch (error) {
      return "";
    }
  };

  // Function to format date only
  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return format(date, "MMM dd, yyyy");
    } catch (error) {
      return "";
    }
  };

  // Label for urgency
  const getUrgencyLabel = (urgency) => {
    switch (urgency) {
      case "high":
        return { label: "High", class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" };
      case "medium":
        return { label: "Medium", class: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" };
      default:
        return { label: "Low", class: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
    }
  };

  // Label for status
  const getStatusLabel = (status) => {
    switch (status) {
      case "pending":
        return { label: "Pending", class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" };
      case "in_progress":
        return { label: "In Progress", class: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
      case "completed":
        return { label: "Completed", class: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" };
      case "cancelled":
        return { label: "Cancelled", class: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" };
      case "rejected":
        return { label: "Rejected", class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" };
      default:
        return { label: status, class: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 font-sans antialiased relative">
      {/* Animated network background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
        <canvas 
          ref={networkCanvasRef}
          className="w-full h-full"
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
      </div>
      
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'dark:bg-gray-800 dark:text-white',
          style: {
            borderRadius: '16px',
            background: '#fff',
            color: '#222',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          },
          success: {
            iconTheme: {
              primary: '#5D5CDE',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 relative z-10">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-primary dark:text-white tracking-tight">
              Lab Tests Dashboard
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Manage and monitor laboratory test requests
            </p>
          </div>
          
          <motion.button
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-2xl hover:shadow-lg hover:shadow-primary/20 transition duration-300 font-medium text-base gap-2"
            onClick={() => setShowRequestForm(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FiPlus className="mr-1" /> New Lab Request
          </motion.button>
        </div>

        {/* Total Tests Metric Card */}
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-slate-100 dark:border-slate-700 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400">
                Total Tests
              </div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {getSafeTotal(analyticsData.status_counts) || 
                metrics.pending + metrics.in_progress + metrics.completed + metrics.cancelled || 0}
              </div>
              <div className="mt-2 flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Pending: {metrics.pending}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Completed: {metrics.completed}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-400 mr-2"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">In Progress: {metrics.in_progress}</span>
                </div>
              </div>
            </div>
            <div 
              className="p-4 rounded-2xl cursor-pointer bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:shadow-md transition-all duration-300"
              onClick={() => fetchAnalyticsData(true)}
            >
              <FiPieChart className="w-8 h-8 text-primary" />
            </div>
          </div>
          
          <div className="mt-6 h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="flex h-full">
              <div 
                className="bg-yellow-400 h-full" 
                style={{ width: `${getSafePercentage(metrics.pending, getSafeTotal(analyticsData.status_counts))}%` }}
              ></div>
              <div 
                className="bg-blue-400 h-full" 
                style={{ width: `${getSafePercentage(metrics.in_progress, getSafeTotal(analyticsData.status_counts))}%` }}
              ></div>
              <div 
                className="bg-green-400 h-full" 
                style={{ width: `${getSafePercentage(metrics.completed, getSafeTotal(analyticsData.status_counts))}%` }}
              ></div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 backdrop-blur-sm bg-opacity-80 dark:bg-opacity-80 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 space-y-4 md:space-y-0">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search patient name, test type or ID..."
                  className="pl-10 pr-4 py-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Sort by:</span>
                <select
                  value={sortParams.sort_by}
                  onChange={(e) => {
                    setSortParams({
                      ...sortParams,
                      sort_by: e.target.value,
                    });
                    fetchLabRequests(0, pageSize);
                  }}
                  className="rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-3 text-sm focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="created_at">Date</option>
                  <option value="urgency">Urgency</option>
                  <option value="test_type">Test Type</option>
                  <option value="status">Status</option>
                </select>
                
                <select
                  value={sortParams.sort_order}
                  onChange={(e) => {
                    setSortParams({
                      ...sortParams,
                      sort_order: e.target.value,
                    });
                    fetchLabRequests(0, pageSize);
                  }}
                  className="rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 py-2 px-3 text-sm focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-32">
              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-primary opacity-20 animate-ping"></div>
                  <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 dark:border-gray-700 border-t-primary"></div>
                </div>
                <p className="mt-6 text-gray-500 dark:text-gray-400 font-medium">Loading lab requests...</p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="text-center py-20">
              <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-5 inline-flex mb-6">
                <FiAlertTriangle className="w-12 h-12 text-red-500 dark:text-red-400" />
              </div>
              <p className="text-red-500 text-xl font-medium mb-2">{errorMessage}</p>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">There was a problem fetching the lab requests data. Please try again or contact support if the issue persists.</p>
              <motion.button
                onClick={() => fetchLabRequests()}
                className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition duration-200 font-medium shadow-lg hover:shadow-primary/20"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <FiRefreshCw className="inline mr-2" /> Try Again
              </motion.button>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-20">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-5 inline-flex mb-6">
                    <FiInfo className="w-12 h-12 text-gray-500 dark:text-gray-400" />
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-xl font-medium mb-2">No lab requests found</p>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">Try adjusting your search or create a new lab request to get started.</p>
                  <motion.button
                    onClick={() => setShowRequestForm(true)}
                    className="px-6 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-xl transition duration-200 font-medium flex items-center mx-auto shadow-lg hover:shadow-primary/20"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <FiPlus className="mr-2" /> New Lab Request
                  </motion.button>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Test Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Request Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Urgency
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Files
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRequests.map((request) => (
                      <motion.tr 
                        key={request.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-150"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/10 to-indigo-200/20 dark:from-primary/20 dark:to-indigo-300/10 flex items-center justify-center mr-3 shadow-sm">
                              <span className="text-primary font-semibold text-lg">
                                {request.patient_name?.charAt(0) || "U"}
                              </span>
                            </div>
                            <div>
                              <div className="text-base font-medium text-gray-900 dark:text-gray-100">
                                {request.patient_name || "Unknown"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                ID: {request.patient_id && request.patient_id.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {request.test_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-xl ${
                              getUrgencyLabel(request.urgency).class
                            }`}
                          >
                            {getUrgencyLabel(request.urgency).label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1.5 inline-flex text-xs leading-5 font-semibold rounded-xl ${
                              getStatusLabel(request.status).class
                            }`}
                          >
                            {getStatusLabel(request.status).label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <div className="mr-2 flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-700">
                              <FiFile className="h-3.5 w-3.5" />
                            </div>
                            {request.file_count || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <motion.button
                              className="flex items-center justify-center p-2 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                              title="View details"
                              onClick={() => fetchLabRequestDetails(request.id)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <FiEye className="w-4 h-4" />
                            </motion.button>
                            {(request.status === "pending" ||
                              request.status === "in_progress") && (
                              <motion.button
                                className="flex items-center justify-center p-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                title="Cancel request"
                                onClick={() => handleCancelRequest(request.id)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <FiX className="w-4 h-4" />
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}

              {filteredRequests.length > 0 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Showing{" "}
                    <span className="font-medium">{Math.min(1 + currentPage * pageSize, totalRequests)}</span> to{" "}
                    <span className="font-medium">{Math.min((currentPage + 1) * pageSize, totalRequests)}</span> of{" "}
                    <span className="font-medium">{totalRequests}</span> results
                  </div>
                  <div className="flex items-center space-x-2">
                    <motion.button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 0}
                      className={`p-2 rounded-xl ${
                        currentPage === 0
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                          : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
                      }`}
                      whileHover={currentPage !== 0 ? { scale: 1.1 } : {}}
                      whileTap={currentPage !== 0 ? { scale: 0.9 } : {}}
                    >
                      <FiChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      Page {currentPage + 1} of{" "}
                      {Math.max(1, Math.ceil(totalRequests / pageSize))}
                    </span>
                    <motion.button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={
                        currentPage >= Math.ceil(totalRequests / pageSize) - 1
                      }
                      className={`p-2 rounded-xl ${
                        currentPage >= Math.ceil(totalRequests / pageSize) - 1
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                          : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
                      }`}
                      whileHover={currentPage < Math.ceil(totalRequests / pageSize) - 1 ? { scale: 1.1 } : {}}
                      whileTap={currentPage < Math.ceil(totalRequests / pageSize) - 1 ? { scale: 0.9 } : {}}
                    >
                      <FiChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              )}

              {isLoadingMore && (
                <div className="flex justify-center mt-4 pb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 dark:border-gray-700 border-t-primary"></div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* New Lab Request Modal */}
      <AnimatePresence>
        {showRequestForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center">
            <motion.div 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 m-4"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    New Lab Test Request
                  </h2>
                  <div className="h-1 w-16 bg-primary rounded-full mt-2"></div>
                </div>
                <motion.button
                  onClick={() => setShowRequestForm(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-6">
                <div>
                  <label
                    htmlFor="patient_id"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Patient
                  </label>
                  <select
                    id="patient_id"
                    name="patient_id"
                    value={newLabRequest.patient_id}
                    onChange={(e) =>
                      setNewLabRequest({
                        ...newLabRequest,
                        patient_id: e.target.value,
                      })
                    }
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm py-3 px-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base"
                    required
                  >
                    <option value="">Select a patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="test_type"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Test Type
                  </label>
                  <select
                    id="test_type"
                    name="test_type"
                    value={newLabRequest.test_type}
                    onChange={(e) =>
                      setNewLabRequest({
                        ...newLabRequest,
                        test_type: e.target.value,
                      })
                    }
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm py-3 px-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base"
                    required
                  >
                    <option value="">Select test type</option>
                    {testTypes.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="urgency"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Urgency
                  </label>
                  <div className="grid grid-cols-3 gap-3 mt-1">
                    <div
                      className={`cursor-pointer rounded-xl flex items-center justify-center py-3 shadow-sm ${
                        newLabRequest.urgency === "low"
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                          : "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                      onClick={() =>
                        setNewLabRequest({ ...newLabRequest, urgency: "low" })
                      }
                    >
                      <span className="text-sm font-medium">Low</span>
                    </div>
                    <div
                      className={`cursor-pointer rounded-xl flex items-center justify-center py-3 shadow-sm ${
                        newLabRequest.urgency === "medium"
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                          : "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                      onClick={() =>
                        setNewLabRequest({ ...newLabRequest, urgency: "medium" })
                      }
                    >
                      <span className="text-sm font-medium">Medium</span>
                    </div>
                    <div
                      className={`cursor-pointer rounded-xl flex items-center justify-center py-3 shadow-sm ${
                        newLabRequest.urgency === "high"
                          ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                          : "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      }`}
                      onClick={() =>
                        setNewLabRequest({ ...newLabRequest, urgency: "high" })
                      }
                    >
                      <span className="text-sm font-medium">High</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    value={newLabRequest.notes}
                    onChange={(e) =>
                      setNewLabRequest({
                        ...newLabRequest,
                        notes: e.target.value,
                      })
                    }
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm py-3 px-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base resize-none"
                    placeholder="Add any special instructions or relevant clinical information"
                  ></textarea>
                </div>

                <div className="mt-8 flex justify-end space-x-3">
                  <motion.button
                    type="button"
                    onClick={() => setShowRequestForm(false)}
                    className="px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="px-6 py-3 border border-transparent rounded-xl shadow-md text-sm font-medium text-white bg-gradient-to-r from-primary to-indigo-600 hover:shadow-lg hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Submit Request
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lab Request Detail Modal */}
      <AnimatePresence>
        {showDetailModal && currentRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center">
            <motion.div 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl p-0 m-4 max-h-[90vh] overflow-hidden"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-gradient-to-r from-primary to-indigo-600 text-white p-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">
                    Lab Request #{currentRequest.id}
                  </h2>
                  <p className="text-indigo-100 mt-1 flex items-center text-sm">
                    <FiActivity className="mr-2 h-3 w-3" /> 
                    Created {formatDateTime(currentRequest.created_at)}
                  </p>
                </div>
                <motion.button
                  onClick={() => setShowDetailModal(false)}
                  className="text-white p-2 rounded-full hover:bg-white/10"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-6rem)]">
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main details */}
                    <div className="md:col-span-2 space-y-6">
                      <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center mb-6">
                          <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-xl mr-4">
                            <FiActivity className="w-6 h-6 text-primary" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            Test Information
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          <div className="bg-white dark:bg-gray-700/30 p-4 rounded-xl shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500 dark:text-gray-400">Test Type</p>
                            <p className="font-semibold text-gray-900 dark:text-white mt-2 text-lg">
                              {currentRequest.test_type}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-700/30 p-4 rounded-xl shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500 dark:text-gray-400">Status</p>
                            <span
                              className={`px-3 py-1 mt-2 inline-flex text-sm leading-5 font-semibold rounded-xl ${
                                getStatusLabel(currentRequest.status).class
                              }`}
                            >
                              {getStatusLabel(currentRequest.status).label}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-gray-700/30 p-4 rounded-xl shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500 dark:text-gray-400">Urgency</p>
                            <span
                              className={`px-3 py-1 mt-2 inline-flex text-sm leading-5 font-semibold rounded-xl ${
                                getUrgencyLabel(currentRequest.urgency).class
                              }`}
                            >
                              {getUrgencyLabel(currentRequest.urgency).label}
                            </span>
                          </div>
                          <div className="bg-white dark:bg-gray-700/30 p-4 rounded-xl shadow-sm">
                            <p className="text-sm font-medium uppercase text-gray-500 dark:text-gray-400">Request Date</p>
                            <p className="font-semibold text-gray-900 dark:text-white mt-2">
                              {formatDateTime(currentRequest.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium uppercase text-gray-500 dark:text-gray-400 mb-2">Notes</p>
                          <div className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-line bg-white dark:bg-gray-700/30 p-4 rounded-xl shadow-sm">
                            {currentRequest.notes || "No notes provided"}
                          </div>
                        </div>
                      </div>

                      {/* Files section */}
                      <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center">
                            <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-xl mr-4">
                              <FiFile className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              Files & Results
                            </h3>
                          </div>
                          <motion.button
                            onClick={() => setShowUploadModal(true)}
                            className="text-white bg-primary hover:bg-primary-dark text-sm flex items-center px-4 py-2 rounded-xl shadow-sm"
                            disabled={
                              currentRequest.status === "completed" ||
                              currentRequest.status === "cancelled" ||
                              currentRequest.status === "rejected"
                            }
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FiUpload className="mr-2" />
                            Upload File
                          </motion.button>
                        </div>

                        {currentRequest.files?.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentRequest.files.map((file, index) => (
                              <motion.div
                                key={file.id}
                                className="flex items-center justify-between p-4 bg-white dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                              >
                                <div className="flex items-center">
                                  <div className="h-12 w-12 flex items-center justify-center bg-primary/10 dark:bg-primary/20 rounded-xl text-primary mr-3">
                                    <FiFile className="h-6 w-6" />
                                  </div>
                                  <div className="ml-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {file.filename}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      {formatDateTime(file.created_at)} • {(file.file_size / 1024).toFixed(2)} KB
                                    </p>
                                  </div>
                                </div>

                                <motion.a
                                  href={file.download_url}
                                  className="text-primary hover:text-primary-dark p-2 rounded-full hover:bg-primary/10 dark:hover:bg-primary/20"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <FiDownload className="h-5 w-5" />
                                </motion.a>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-10 bg-white dark:bg-gray-700/30 rounded-xl">
                            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full inline-flex mb-3">
                              <FiFile className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-base">No files attached yet</p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Files and results will appear here once uploaded</p>
                          </div>
                        )}
                      </div>

                      {/* Comments section */}
                      <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center">
                            <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-xl mr-4">
                              <FiMessageCircle className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              Comments
                            </h3>
                          </div>
                          <motion.button
                            onClick={() => setShowCommentModal(true)}
                            className="text-white bg-primary hover:bg-primary-dark text-sm flex items-center px-4 py-2 rounded-xl shadow-sm"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <FiMessageCircle className="mr-2" />
                            Add Comment
                          </motion.button>
                        </div>

                        {currentRequest.comments?.length > 0 ? (
                          <div className="space-y-4">
                            {currentRequest.comments.map((comment, index) => (
                              <motion.div
                                key={comment.id}
                                className="bg-white dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-indigo-300/20 dark:from-primary/30 dark:to-indigo-400/10 flex items-center justify-center mr-3 text-primary font-semibold">
                                      {comment.user_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {comment.user_name}
                                      </span>
                                      <span className="mx-2 text-gray-400 dark:text-gray-500">•</span>
                                      <span className="text-sm text-gray-500 dark:text-gray-400">
                                        {comment.user_role}
                                      </span>
                                    </div>
                                  </div>
                                  {comment.is_private && (
                                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs px-2 py-1 rounded-full font-medium">
                                      Private
                                    </span>
                                  )}
                                </div>
                                <div className="mt-3 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
                                  {comment.comment}
                                </div>
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  {formatDateTime(comment.created_at)}
                                </p>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-10 bg-white dark:bg-gray-700/30 rounded-xl">
                            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full inline-flex mb-3">
                              <FiMessageCircle className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-base">No comments yet</p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Comments and notifications will appear here</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sidebar with patient info */}
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-750 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                        <div className="flex items-center mb-6">
                          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-indigo-500 dark:from-primary dark:to-indigo-600 flex items-center justify-center text-2xl text-white font-semibold shadow-lg">
                            {currentRequest.patient_name?.charAt(0) || "P"}
                          </div>
                          <div className="ml-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {currentRequest.patient_name}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Patient
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-gray-700/30 p-3 rounded-xl shadow-sm">
                              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Age</p>
                              <p className="font-semibold text-gray-900 dark:text-white mt-1 text-lg">
                                {currentRequest.patient_age}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-gray-700/30 p-3 rounded-xl shadow-sm">
                              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Gender</p>
                              <p className="font-semibold text-gray-900 dark:text-white mt-1 text-lg">
                                {currentRequest.gender}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-gray-700/30 p-3 rounded-xl shadow-sm">
                              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Blood Group</p>
                              <p className="font-semibold text-gray-900 dark:text-white mt-1 text-lg">
                                {currentRequest.blood_group}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-gray-700/30 p-3 rounded-xl shadow-sm">
                              <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Contact</p>
                              <p className="font-semibold text-gray-900 dark:text-white mt-1 text-base">
                                {currentRequest.contact_number}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                          Actions
                        </h3>
                        <div className="space-y-3">
                          {(currentRequest.status === "pending" ||
                            currentRequest.status === "in_progress") && (
                            <>
                              <motion.button
                                onClick={() => {
                                  // Ask for confirmation
                                  if (
                                    window.confirm(
                                      "Are you sure you want to cancel this lab request?"
                                    )
                                  ) {
                                    handleCancelRequest(currentRequest.id);
                                    // Close the detail modal after cancellation
                                    setShowDetailModal(false);
                                  }
                                }}
                                className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/20 transition duration-200"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <FiX className="mr-2" />
                                Cancel Request
                              </motion.button>

                              <motion.button
                                onClick={() => {
                                  const newUrgency = prompt(
                                    `Current urgency: ${currentRequest.urgency}. Enter new urgency level (high, medium, low):`,
                                    currentRequest.urgency
                                  );

                                  if (
                                    newUrgency &&
                                    ["high", "medium", "low"].includes(
                                      newUrgency.toLowerCase()
                                    )
                                  ) {
                                    handleUpdateRequest(currentRequest.id, {
                                      urgency: newUrgency.toLowerCase(),
                                    });
                                  } else if (newUrgency) {
                                    toast.error("Invalid urgency level. Must be one of: high, medium, low");
                                  }
                                }}
                                className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition duration-200"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <FiAlertCircle className="mr-2" />
                                Update Urgency
                              </motion.button>

                              <motion.button
                                onClick={() => {
                                  const newNotes = prompt(
                                    "Update notes:",
                                    currentRequest.notes
                                  );

                                  if (newNotes !== null) {
                                    handleUpdateRequest(currentRequest.id, {
                                      notes: newNotes,
                                    });
                                  }
                                }}
                                className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:shadow-lg hover:shadow-gray-600/20 transition duration-200"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <FiSettings className="mr-2" />
                                Update Notes
                              </motion.button>
                            </>
                          )}
                          <motion.button
                            onClick={() => {
                              window.open(
                                `/patients/${currentRequest.patient_id}`,
                                "_blank"
                              );
                            }}
                            className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition duration-200"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <FiEye className="mr-2" />
                            View Patient Record
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Comment Modal */}
      <AnimatePresence>
        {showCommentModal && currentRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center">
            <motion.div 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 m-4"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Add Comment
                  </h2>
                  <div className="h-1 w-16 bg-primary rounded-full mt-2"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    For Lab Request #{currentRequest.id}
                  </p>
                </div>
                <motion.button
                  onClick={() => setShowCommentModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <form onSubmit={handleAddComment} className="space-y-5">
                <div>
                  <label
                    htmlFor="comment"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Comment
                  </label>
                  <textarea
                    id="comment"
                    name="comment"
                    rows={5}
                    value={newComment.comment}
                    onChange={(e) =>
                      setNewComment({ ...newComment, comment: e.target.value })
                    }
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm py-3 px-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base resize-none"
                    placeholder="Enter your comment here"
                    required
                  ></textarea>
                </div>

                <div className="flex items-center">
                  <div className="relative inline-block w-12 h-6 mr-2">
                    <input
                      id="is_private"
                      name="is_private"
                      type="checkbox"
                      checked={newComment.is_private}
                      onChange={(e) =>
                        setNewComment({
                          ...newComment,
                          is_private: e.target.checked,
                        })
                      }
                      className="hidden"
                    />
                    <label
                      htmlFor="is_private"
                      className={`absolute inset-0 cursor-pointer rounded-full transition-colors duration-300 ${
                        newComment.is_private 
                          ? "bg-primary" 
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span 
                        className={`absolute inset-y-0 left-0 top-0 h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-300 ${
                          newComment.is_private ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </label>
                  </div>
                  <label
                    htmlFor="is_private"
                    className="block text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    Private comment (only visible to you)
                  </label>
                </div>

                <div className="mt-8 flex justify-end space-x-3">
                  <motion.button
                    type="button"
                    onClick={() => setShowCommentModal(false)}
                    className="px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="px-6 py-3 border border-transparent rounded-xl shadow-md text-sm font-medium text-white bg-gradient-to-r from-primary to-indigo-600 hover:shadow-lg hover:shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Submit Comment
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload File Modal */}
      <AnimatePresence>
        {showUploadModal && currentRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center">
            <motion.div 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 m-4"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Upload File
                  </h2>
                  <div className="h-1 w-16 bg-primary rounded-full mt-2"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    For Lab Request #{currentRequest.id}
                  </p>
                </div>
                <motion.button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    File
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 transition-colors duration-200">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 mb-2 rounded-full bg-primary/10 dark:bg-primary/20">
                          <FiUpload className="w-8 h-8 text-primary" />
                        </div>
                        <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">Click to upload</span>{" "}
                          or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PDF, PNG, JPEG, DOC, DOCX (MAX. 10MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setFileUpload({
                              ...fileUpload,
                              file: e.target.files[0],
                            });
                          }
                        }}
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      />
                    </label>
                  </div>
                  {fileUpload.file && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-primary/5 to-indigo-50 dark:from-primary/10 dark:to-indigo-900/10 rounded-xl border border-primary/20 dark:border-primary/30">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex items-center justify-center bg-primary/10 dark:bg-primary/20 rounded-xl text-primary mr-3 shadow-sm">
                          <FiFile className="h-5 w-5" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {fileUpload.file.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(fileUpload.file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    id="description"
                    name="description"
                    value={fileUpload.description}
                    onChange={(e) =>
                      setFileUpload({
                        ...fileUpload,
                        description: e.target.value,
                      })
                    }
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm py-3 px-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base"
                    placeholder="Brief description of the file"
                  />
                </div>

                <div className="mt-8 flex justify-end space-x-3">
                  <motion.button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    className={`px-6 py-3 border border-transparent rounded-xl shadow-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                      fileUpload.file 
                        ? "bg-gradient-to-r from-primary to-indigo-600 hover:shadow-lg hover:shadow-primary/20" 
                        : "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                    }`}
                    disabled={!fileUpload.file}
                    whileHover={fileUpload.file ? { scale: 1.02 } : {}}
                    whileTap={fileUpload.file ? { scale: 0.98 } : {}}
                  >
                    Upload File
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Analytics Modal */}
      <AnimatePresence>
        {showAnalyticsModal && analyticsData && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center">
            <motion.div 
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl p-0 m-4 max-h-[90vh] overflow-hidden"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-gradient-to-r from-primary to-indigo-600 text-white p-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">
                    Lab Requests Analytics
                  </h2>
                  <p className="text-indigo-100 mt-1">
                    {formatDate(analyticsData.date_range?.from) || "All time"} to{" "}
                    {formatDate(analyticsData.date_range?.to) || "present"}
                  </p>
                </div>
                <motion.button
                  onClick={() => setShowAnalyticsModal(false)}
                  className="text-white p-2 rounded-full hover:bg-white/10"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FiX className="w-6 h-6" />
                </motion.button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-4rem)]">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
                  <motion.div 
                    className="bg-gradient-to-br from-primary/10 to-blue-100/20 dark:from-primary/20 dark:to-blue-900/20 p-6 rounded-2xl border border-primary/20 dark:border-primary/30 shadow-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="flex items-center">
                      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                        <FiPieChart className="w-8 h-8 text-primary" />
                      </div>
                      <div className="ml-6">
                        <h3 className="text-sm font-medium uppercase text-gray-500 dark:text-gray-400">
                          Total Lab Requests
                        </h3>
                        <p className="text-4xl font-bold text-gray-900 dark:text-white mt-1">
                          {getSafeTotal(analyticsData.status_counts)}
                        </p>
                        <div className="mt-2 flex items-center space-x-4">
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-300">Pending: {analyticsData.status_counts?.pending || 0}</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-300">Completed: {analyticsData.status_counts?.completed || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <motion.div 
                    className="bg-white dark:bg-gray-800/80 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  >
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                      Status Distribution
                    </h3>
                    <div className="h-64">
                      <canvas ref={statusChartRef}></canvas>
                    </div>
                  </motion.div>

                  <motion.div 
                    className="bg-white dark:bg-gray-800/80 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  >
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                      Top Test Types
                    </h3>
                    <div className="h-64">
                      <canvas ref={typeChartRef}></canvas>
                    </div>
                  </motion.div>

                  <motion.div 
                    className="bg-white dark:bg-gray-800/80 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md md:col-span-2 lg:col-span-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                  >
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                      Urgency Breakdown
                    </h3>
                    <div className="flex items-center justify-around p-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-500 dark:text-blue-400">
                          {analyticsData.urgency_counts?.low || 0}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Low</div>
                      </div>

                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-500 dark:text-orange-400">
                          {analyticsData.urgency_counts?.medium || 0}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Medium</div>
                      </div>

                      <div className="text-center">
                        <div className="text-3xl font-bold text-red-500 dark:text-red-400">
                          {analyticsData.urgency_counts?.high || 0}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">High</div>
                      </div>
                    </div>

                    {/* Visual bar representation */}
                    <div className="mt-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden">
                      <div className="flex h-full">
                        {/* Safe calculations using helper functions */}
                        <div
                          className="bg-blue-500 dark:bg-blue-600 h-full rounded-l-xl"
                          style={{
                            width: `${getSafePercentage(
                              analyticsData.urgency_counts?.low || 0,
                              getSafeTotal(analyticsData.urgency_counts)
                            )}%`,
                          }}
                        ></div>
                        <div
                          className="bg-orange-500 dark:bg-orange-600 h-full"
                          style={{
                            width: `${getSafePercentage(
                              analyticsData.urgency_counts?.medium || 0,
                              getSafeTotal(analyticsData.urgency_counts)
                            )}%`,
                          }}
                        ></div>
                        <div
                          className="bg-red-500 dark:bg-red-600 h-full rounded-r-xl"
                          style={{
                            width: `${getSafePercentage(
                              analyticsData.urgency_counts?.high || 0,
                              getSafeTotal(analyticsData.urgency_counts)
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Low: {getSafePercentage(
                          analyticsData.urgency_counts?.low || 0,
                          getSafeTotal(analyticsData.urgency_counts)
                        )}%
                      </span>
                      <span>
                        Medium: {getSafePercentage(
                          analyticsData.urgency_counts?.medium || 0,
                          getSafeTotal(analyticsData.urgency_counts)
                        )}%
                      </span>
                      <span>
                        High: {getSafePercentage(
                          analyticsData.urgency_counts?.high || 0,
                          getSafeTotal(analyticsData.urgency_counts)
                        )}%
                      </span>
                    </div>
                  </motion.div>
                </div>

                <motion.div 
                  className="mt-8 bg-white dark:bg-gray-800/80 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                    Requests Trend
                  </h3>
                  <div className="h-72">
                    <canvas ref={trendChartRef}></canvas>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
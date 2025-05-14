import React, { useState, useEffect, useRef } from "react";
import {
  FiSearch,
  FiEdit2,
  FiEye,
  FiTrash2,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiUserPlus,
  FiFilter,
  FiChevronDown,
  FiEyeOff,
  FiKey,
  FiCalendar,
  FiPhone,
  FiMail,
  FiUser,
  FiInfo,
  FiPlus,
  FiRefreshCw,
  FiCheck,
  FiArrowLeft,
  FiArrowRight,
  FiShield,
  FiFileText,
  FiHeart,
  FiAward,
  FiPlusCircle,
  FiMinusCircle,
  FiClipboard,
  FiStar,
  FiSettings,
  FiShield as FiShieldIcon
} from "react-icons/fi";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

function RegisterPatient() {
  const location = useLocation();
  const { cardroomClient } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPatientId, setEditPatientId] = useState(null);
  const [notification, setNotification] = useState({
    show: false,
    type: "", // 'success' or 'error'
    message: "",
  });
  const [newPatientId, setNewPatientId] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    pages: 1,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [filters, setFilters] = useState({
    gender: "",
    ageMin: "",
    ageMax: "",
    bloodGroup: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldFocus, setFieldFocus] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [formTouched, setFormTouched] = useState({});
  const [viewPatientDetail, setViewPatientDetail] = useState(null);
  const [patientDetailData, setPatientDetailData] = useState(null);
  const [medicalHistoryItems, setMedicalHistoryItems] = useState([]);
  const [allergiesItems, setAllergiesItems] = useState([]);
  
  const modalRef = useRef(null);
  const searchRef = useRef(null);
  const filterRef = useRef(null);
  const navigate = useNavigate();

  // Patient registration form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    phone_number: "",
    email: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    medical_history: {},
    allergies: [],
    blood_group: "",
  });
  const [formError, setFormError] = useState("");

  // Check for dark mode
  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      document.documentElement.classList.add("dark");
      setIsDarkMode(true);
    }

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        if (event.matches) {
          document.documentElement.classList.add("dark");
          setIsDarkMode(true);
        } else {
          document.documentElement.classList.remove("dark");
          setIsDarkMode(false);
        }
      });
  }, []);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsModalOpen(false);
      }
    }

    // Add event listener when the modal is open
    if (isModalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Cleanup the event listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModalOpen]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutsideFilter(event) {
      if (filterOpen && filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    }

    if (filterOpen) {
      document.addEventListener("mousedown", handleClickOutsideFilter);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideFilter);
    };
  }, [filterOpen]);

  // Close patient detail modal when clicking outside
  useEffect(() => {
    function handleClickOutsidePatientDetail(event) {
      const modal = document.getElementById('patient-detail-modal');
      if (viewPatientDetail && modal && !modal.contains(event.target)) {
        setViewPatientDetail(null);
      }
    }

    if (viewPatientDetail) {
      document.addEventListener("mousedown", handleClickOutsidePatientDetail);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutsidePatientDetail);
    };
  }, [viewPatientDetail]);

  // Convert medical history object to array of items for better UI
  useEffect(() => {
    if (formData.medical_history && typeof formData.medical_history === 'object') {
      const items = [];
      // Convert object to array of {key, value} pairs
      Object.entries(formData.medical_history).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => {
            items.push({ category: key, condition: item });
          });
        } else if (typeof value === 'string') {
          items.push({ category: key, condition: value });
        }
      });
      setMedicalHistoryItems(items);
    }
  }, [formData.medical_history]);

  // Convert allergies array to state for UI
  useEffect(() => {
    if (formData.allergies && Array.isArray(formData.allergies)) {
      setAllergiesItems(formData.allergies.map(item => ({ name: item })));
    }
  }, [formData.allergies]);

  const fetchPatients = async () => {
    try {
      let url;
      // If search term exists, use the search endpoint instead
      if (searchTerm) {
        url = `http://localhost:8023/api/patients/search`;
        const response = await axios.post(url, {
          query: searchTerm,
          page: pagination.page,
          page_size: pagination.pageSize,
          filters, // Include filters in search
        });
        const data = response.data;
        setPatients(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.total,
          pages: data.pages,
        }));
      } else {
        // Normal listing without search
        url = `http://localhost:8023/api/patients?page=${pagination.page}&pageSize=${pagination.pageSize}`;
        // Add filter parameters if any
        if (
          filters.gender ||
          filters.ageMin ||
          filters.ageMax ||
          filters.bloodGroup
        ) {
          const filterParams = new URLSearchParams();
          if (filters.gender) filterParams.append("gender", filters.gender);
          if (filters.ageMin) filterParams.append("ageMin", filters.ageMin);
          if (filters.ageMax) filterParams.append("ageMax", filters.ageMax);
          if (filters.bloodGroup)
            filterParams.append("bloodGroup", filters.bloodGroup);
          url += `&${filterParams.toString()}`;
        }

        const response = await axios.get(url);
        const data = response.data;
        setPatients(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.total,
          pages: data.pages,
        }));
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
      showNotification("error", "Failed to load patients data");
    }
  };

  // Debounced search function for real-time filtering
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm !== undefined) {
        setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
        fetchPatients();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Check for location state (success message from navigation)
  useEffect(() => {
    if (location.state?.success) {
      showNotification("success", location.state.success);
      navigate(location.pathname, { replace: true }); // Clear the state
    }

    fetchPatients();
  }, [pagination.page, pagination.pageSize, location, filters]);

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
    setFilterOpen(false);
    fetchPatients();
  };

  const resetFilters = () => {
    setFilters({
      gender: "",
      ageMin: "",
      ageMax: "",
      bloodGroup: "",
    });

    // Apply immediately
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilterOpen(false);
    // fetchPatients will be called via the useEffect that watches filters
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const showNotification = (type, message) => {
    setNotification({
      show: true,
      type,
      message,
    });

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 5000);
  };

  const fetchPatientDetail = async (id) => {
    try {
      setIsLoading(true);
      const response = await axios.get(`http://localhost:8023/api/patients/${id}`);
      setPatientDetailData(response.data);
      setViewPatientDetail(id);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching patient details:", error);
      showNotification("error", "Failed to load patient details");
      setIsLoading(false);
    }
  };

  const deletePatient = async (id) => {
    try {
      const url = `http://localhost:8023/api/patients/${id}`;
      await axios.delete(url);

      // Show success notification with animation
      showNotification("success", "Patient deleted successfully");

      // Refresh the patient list
      fetchPatients();
    } catch (error) {
      console.error("Error deleting patient:", error);
      showNotification("error", "Failed to delete patient");
    }
  };

  const confirmDelete = (id) => {
    return new Promise((resolve) => {
      // Create a modal for confirmation
      const modalElement = document.createElement("div");
      modalElement.className =
        "fixed inset-0 z-50 flex items-center justify-center";
      modalElement.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-xl max-w-md w-full mx-auto p-6 shadow-xl border border-gray-100 dark:border-gray-700">
          <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500"></div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Confirm Deletion</h3>
          <p class="text-sm text-gray-500 dark:text-gray-300 mb-6">Are you sure you want to delete this patient? This action cannot be undone.</p>
          <div class="flex justify-end space-x-3">
            <button id="cancel-delete" class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors">
              Cancel
            </button>
            <button id="confirm-delete" class="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all">
              Delete
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalElement);

      // Add event listeners
      document.getElementById("cancel-delete").addEventListener("click", () => {
        document.body.removeChild(modalElement);
        resolve(false);
      });

      document
        .getElementById("confirm-delete")
        .addEventListener("click", () => {
          document.body.removeChild(modalElement);
          resolve(true);
        });
    });
  };

  const calculateAge = (dob) => {
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const age = new Date(difference);
    return Math.abs(age.getUTCFullYear() - 1970);
  };

  // Form validation function
  const validateForm = (checkTouched = true) => {
    const errors = {};
    let isValid = true;

    // First name validation
    if ((!checkTouched || formTouched.first_name) && !formData.first_name.trim()) {
      errors.first_name = "First name is required";
      isValid = false;
    }

    // Last name validation
    if ((!checkTouched || formTouched.last_name) && !formData.last_name.trim()) {
      errors.last_name = "Last name is required";
      isValid = false;
    }

    // Date of birth validation
    if ((!checkTouched || formTouched.date_of_birth) && !formData.date_of_birth) {
      errors.date_of_birth = "Date of birth is required";
      isValid = false;
    } else if (formData.date_of_birth) {
      const dobDate = new Date(formData.date_of_birth);
      const today = new Date();
      if (dobDate > today) {
        errors.date_of_birth = "Date cannot be in the future";
        isValid = false;
      }
    }

    // Gender validation
    if ((!checkTouched || formTouched.gender) && !formData.gender) {
      errors.gender = "Gender is required";
      isValid = false;
    }

    // Phone validation
    if ((!checkTouched || formTouched.phone_number) && !formData.phone_number) {
      errors.phone_number = "Phone number is required";
      isValid = false;
    } else if (formData.phone_number && !/^\+?[0-9\s-()]{8,}$/.test(formData.phone_number)) {
      errors.phone_number = "Please enter a valid phone number";
      isValid = false;
    }

    // Email validation (only if provided)
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
      isValid = false;
    }

    // Emergency phone validation (only if provided)
    if (
      formData.emergency_contact_phone &&
      !/^\+?[0-9\s-()]{8,}$/.test(formData.emergency_contact_phone)
    ) {
      errors.emergency_contact_phone = "Please enter a valid phone number";
      isValid = false;
    }

    setValidationErrors(errors);
    setFormValid(isValid);

    return isValid;
  };

  // Form handling functions
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Mark field as touched
    setFormTouched(prev => ({
      ...prev,
      [name]: true
    }));

    // Only validate fields that have been touched
    setTimeout(() => validateForm(), 300);
  };

  const updateMedicalHistory = () => {
    // Convert the UI-friendly array back to the required object format
    const historyObj = {};
    
    medicalHistoryItems.forEach(item => {
      if (!historyObj[item.category]) {
        historyObj[item.category] = [];
      }
      
      if (Array.isArray(historyObj[item.category])) {
        historyObj[item.category].push(item.condition);
      }
    });
    
    setFormData(prev => ({
      ...prev,
      medical_history: historyObj
    }));
  };

  const addMedicalHistoryItem = () => {
    setMedicalHistoryItems(prev => [
      ...prev, 
      { category: '', condition: '' }
    ]);
  };

  const removeMedicalHistoryItem = (index) => {
    const newItems = [...medicalHistoryItems];
    newItems.splice(index, 1);
    setMedicalHistoryItems(newItems);
    
    // Update the formData after removing
    setTimeout(() => updateMedicalHistory(), 0);
  };

  const updateMedicalHistoryItem = (index, field, value) => {
    const newItems = [...medicalHistoryItems];
    newItems[index][field] = value;
    setMedicalHistoryItems(newItems);
    
    // Update the formData after changing
    setTimeout(() => updateMedicalHistory(), 0);
  };

  const addAllergyItem = () => {
    setAllergiesItems(prev => [...prev, { name: '' }]);
  };

  const removeAllergyItem = (index) => {
    const newItems = [...allergiesItems];
    newItems.splice(index, 1);
    setAllergiesItems(newItems);
    
    // Update allergies in formData
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        allergies: newItems.map(item => item.name).filter(name => name)
      }));
    }, 0);
  };

  const updateAllergyItem = (index, value) => {
    const newItems = [...allergiesItems];
    newItems[index].name = value;
    setAllergiesItems(newItems);
    
    // Update allergies in formData
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        allergies: newItems.map(item => item.name).filter(name => name)
      }));
    }, 0);
  };

  const handleFocus = (fieldName) => {
    setFieldFocus((prev) => ({ ...prev, [fieldName]: true }));
  };

  const handleBlur = (fieldName) => {
    setFieldFocus((prev) => ({ ...prev, [fieldName]: false }));
    
    // Mark field as touched
    setFormTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
    
    // Validate on blur
    validateForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    // Mark all fields as touched
    const allTouched = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setFormTouched(allTouched);

    // Validate form before submission
    if (!validateForm(false)) return;

    try {
      setIsSubmitting(true);
      let response;

      if (isEditMode) {
        // Update existing patient
        response = await axios.put(
          `http://localhost:8023/api/patients/${editPatientId}`,
          formData
        );
        if (response.status === 200) {
          setIsModalOpen(false);
          showNotification("success", "Patient updated successfully");

          // Mark the updated patient for highlighting
          setNewPatientId(editPatientId);

          fetchPatients();
        }
      } else {
        // Create new patient
        response = await cardroomClient.post("/api/patients", formData);
        if (response.status === 201) {
          setIsModalOpen(false);
          showNotification("success", "Patient registered successfully");

          // Reset form data
          resetForm();

          // Mark the new patient for highlighting
          setNewPatientId(response.data.id);

          // Refresh patient list
          fetchPatients();
        }
      }
    } catch (error) {
      if (error.response) {
        setFormError(error.response.data.detail || "Operation failed");
      } else {
        setFormError("Network error. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
      phone_number: "",
      email: "",
      address: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      medical_history: {},
      allergies: [],
      blood_group: "",
    });
    setValidationErrors({});
    setFormTouched({});
    setFormValid(false);
    setFieldFocus({});
    setMedicalHistoryItems([]);
    setAllergiesItems([]);
  };

  const openAddModal = () => {
    resetForm();
    setIsEditMode(false);
    setEditPatientId(null);
    setIsModalOpen(true);
  };

  const openEditModal = async (patientId) => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `http://localhost:8023/api/patients/${patientId}`
      );
      const patientData = response.data;

      // Set the form data
      setFormData({
        ...patientData,
        medical_history: patientData.medical_history || {},
        allergies: patientData.allergies || []
      });

      // Set edit mode and open modal
      setIsEditMode(true);
      setEditPatientId(patientId);
      setIsModalOpen(true);
      setIsLoading(false);

      // Don't validate until user makes changes
      setFormTouched({});
      setValidationErrors({});
      setFormValid(true);
    } catch (error) {
      console.error("Error fetching patient data:", error);
      showNotification("error", "Failed to load patient data for editing");
      setIsLoading(false);
    }
  };

  const isNewPatient = (patientId) => {
    return patientId === newPatientId;
  };

  // Get page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    if (pagination.pages <= maxPagesToShow) {
      // Show all pages if there are fewer than maxPagesToShow
      for (let i = 1; i <= pagination.pages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first and last page
      pages.push(1);

      // Calculate middle pages to show
      const currentPage = pagination.page;
      const middleStart = Math.max(2, currentPage - 1);
      const middleEnd = Math.min(pagination.pages - 1, currentPage + 1);

      if (middleStart > 2) {
        pages.push("...");
      }

      for (let i = middleStart; i <= middleEnd; i++) {
        pages.push(i);
      }

      if (middleEnd < pagination.pages - 1) {
        pages.push("...");
      }

      pages.push(pagination.pages);
    }

    return pages;
  };

  // Has active filters check
  const hasActiveFilters = () => {
    return (
      filters.gender || filters.ageMin || filters.ageMax || filters.bloodGroup
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-blue-50/50 to-teal-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors duration-300 py-6 px-4 sm:px-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-repeat opacity-5 pointer-events-none dark:opacity-[0.03]" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
     
      {/* Animated Network Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-20 dark:opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="network-pattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M0 25 C 10 10, 40 10, 50 25 M50 25 C 40 40, 10 40, 0 25" className="stroke-indigo-500/30 dark:stroke-indigo-400/30" strokeWidth="0.5" fill="none" />
                <path d="M25 0 C 10 10, 10 40, 25 50 M25 50 C 40 40, 40 10, 25 0" className="stroke-teal-500/30 dark:stroke-teal-400/30" strokeWidth="0.5" fill="none" />
              </pattern>
              <linearGradient id="network-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(79, 70, 229, 0.05)" />
                <stop offset="50%" stopColor="rgba(16, 185, 129, 0.05)" />
                <stop offset="100%" stopColor="rgba(99, 102, 241, 0.05)" />
              </linearGradient>
              <radialGradient id="network-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.05)" />
                <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
              </radialGradient>
              <filter id="network-blur">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#network-pattern)" className="network-animation" />
            <rect x="0" y="0" width="100%" height="100%" fill="url(#network-gradient)" />
            <circle cx="50%" cy="50%" r="30%" fill="url(#network-glow)" filter="url(#network-blur)" className="animate-pulse-slow" />
          </svg>
        </div>
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center">
            <svg className="animate-spin h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Loading...</span>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        {/* Enhanced Search and Add Patient header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg p-6 backdrop-blur-sm border border-gray-100/50 dark:border-gray-700/50"
        >
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-teal-400">
                Patient Management
              </h2>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={openAddModal}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl shadow-md text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 whitespace-nowrap"
                aria-label="Add new patient"
              >
                <FiUserPlus className="h-5 w-5 mr-2" />
                <span>Add Patient</span>
              </motion.button>
            </div>

            {/* Improved search and filter layout */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-grow w-full max-w-3xl">
                <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors duration-200 ${searchFocused ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  <FiSearch className="h-5 w-5" />
                </div>
                <input
                  ref={searchRef}
                  type="text"
                  className={`block w-full pl-10 pr-12 py-3 text-base border-0 bg-gray-50 dark:bg-gray-700/70 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white transition-all duration-200 shadow-sm placeholder-gray-400 dark:placeholder-gray-500 ${searchFocused ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : 'ring-1 ring-gray-200 dark:ring-gray-600'}`}
                  placeholder="Search patients by name, ID, phone, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  aria-label="Search patients"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    aria-label="Clear search"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Enhanced Filter dropdown */}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={`flex items-center justify-center px-4 py-3 rounded-xl shadow-sm font-medium text-sm transition-all duration-200 ${
                    hasActiveFilters()
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/30"
                      : "bg-gray-50 text-gray-700 dark:bg-gray-700/70 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600/70 border border-gray-200 dark:border-gray-700"
                  }`}
                  aria-label="Filter options"
                  aria-expanded={filterOpen}
                  aria-haspopup="true"
                >
                  <FiFilter
                    className={`h-4 w-4 mr-2 ${
                      hasActiveFilters()
                        ? "text-indigo-500 dark:text-indigo-400"
                        : ""
                    }`}
                  />
                  <span>{hasActiveFilters() ? "Filters Active" : "Filter"}</span>
                  {hasActiveFilters() && (
                    <span className="ml-1.5 flex items-center justify-center bg-indigo-500 text-white text-xs font-bold rounded-full h-5 w-5 dark:bg-indigo-400 dark:text-gray-900">
                      {Object.values(filters).filter((v) => v !== "").length}
                    </span>
                  )}
                  <FiChevronDown
                    className={`h-4 w-4 ml-2 transition-transform duration-300 ${
                      filterOpen ? "transform rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {filterOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="fixed md:absolute left-1/2 md:left-auto right-auto md:right-0 -translate-x-1/2 md:translate-x-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 z-[100] border border-gray-100 dark:border-gray-700"
                    >
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Gender
                          </label>
                          <select
                            name="gender"
                            value={filters.gender}
                            onChange={handleFilterChange}
                            className="w-full rounded-lg bg-gray-50 dark:bg-gray-700 border-0 text-sm text-gray-800 dark:text-gray-200 py-2.5 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 shadow-sm"
                          >
                            <option value="">All</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Age Range
                          </label>
                          <div className="flex space-x-2 items-center">
                            <input
                              type="number"
                              name="ageMin"
                              placeholder="Min"
                              value={filters.ageMin}
                              onChange={handleFilterChange}
                              min="0"
                              max="120"
                              className="w-1/2 rounded-lg bg-gray-50 dark:bg-gray-700 border-0 text-sm text-gray-800 dark:text-gray-200 py-2.5 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 shadow-sm"
                            />
                            <span className="text-gray-500 dark:text-gray-400">
                              --
                            </span>
                            <input
                              type="number"
                              name="ageMax"
                              placeholder="Max"
                              value={filters.ageMax}
                              onChange={handleFilterChange}
                              min="0"
                              max="120"
                              className="w-1/2 rounded-lg bg-gray-50 dark:bg-gray-700 border-0 text-sm text-gray-800 dark:text-gray-200 py-2.5 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 shadow-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Blood Group
                          </label>
                          <select
                            name="bloodGroup"
                            value={filters.bloodGroup}
                            onChange={handleFilterChange}
                            className="w-full rounded-lg bg-gray-50 dark:bg-gray-700 border-0 text-sm text-gray-800 dark:text-gray-200 py-2.5 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 shadow-sm"
                          >
                            <option value="">All</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                          <button
                            onClick={resetFilters}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
                          >
                            Reset
                          </button>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={applyFilters}
                            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm"
                          >
                            Apply Filters
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Improved Notification component - animated */}
        <AnimatePresence>
          {notification.show && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="fixed top-20 inset-x-0 z-50 flex justify-center px-4"
            >
              <div
                className={`px-6 py-3 rounded-xl shadow-xl flex items-center max-w-md backdrop-blur-sm ${
                  notification.type === "success"
                    ? "bg-green-50/90 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30"
                    : "bg-red-50/90 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30"
                }`}
              >
                {notification.type === "success" ? (
                  <FiCheckCircle className="h-5 w-5 mr-3 text-green-500 dark:text-green-400" />
                ) : (
                  <FiAlertCircle className="h-5 w-5 mr-3 text-red-500 dark:text-red-400" />
                )}
                <span className="font-medium">{notification.message}</span>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() =>
                    setNotification((prev) => ({ ...prev, show: false }))
                  }
                  className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  aria-label="Close notification"
                >
                  <FiX className="h-4 w-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Patients Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg overflow-hidden backdrop-blur-sm border border-gray-100/50 dark:border-gray-700/50"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50/80 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Patient Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/60 dark:bg-gray-800/60 divide-y divide-gray-200 dark:divide-gray-700">
                {patients.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      <div className="flex flex-col items-center">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="w-20 h-20 mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500"
                        >
                          <FiSearch className="w-8 h-8" />
                        </motion.div>
                        <motion.div
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                        >
                          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-1">No patients found</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-md mx-auto">
                            {searchTerm 
                              ? `No results found for "${searchTerm}". Try a different search term.` 
                              : "Try adjusting your filters or add a new patient to get started."}
                          </p>
                          <div className="flex flex-wrap justify-center gap-3">
                            {searchTerm && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSearchTerm("")}
                                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
                              >
                                <FiX className="mr-1.5 h-3.5 w-3.5" /> Clear Search
                              </motion.button>
                            )}
                            {hasActiveFilters() && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={resetFilters}
                                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center"
                              >
                                <FiRefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reset Filters
                              </motion.button>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={openAddModal}
                              className="px-4 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-colors flex items-center"
                            >
                              <FiPlus className="mr-1.5 h-3.5 w-3.5" /> Add Patient
                            </motion.button>
                          </div>
                        </motion.div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  patients.map((patient, index) => (
                    <motion.tr
                      key={patient.id}
                      className={`hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors duration-150 ${
                        isNewPatient(patient.id)
                          ? "dark:bg-purple-900/20 bg-purple-50"
                          : ""
                      }`}
                      initial={
                        isNewPatient(patient.id)
                          ? {
                              backgroundColor: isDarkMode ? "rgba(107, 70, 193, 0.3)" : "rgba(233, 213, 255, 0.8)",
                              y: -5,
                              opacity: 0
                            }
                          : { opacity: 0, y: 10 }
                      }
                      animate={
                        isNewPatient(patient.id)
                          ? {
                              backgroundColor: isDarkMode
                                ? "rgba(107, 70, 193, 0.2)"
                                : "rgba(237, 233, 254, 0.5)",
                              y: 0,
                              opacity: 1
                            }
                          : { opacity: 1, y: 0 }
                      }
                      transition={{ 
                        duration: isNewPatient(patient.id) ? 1.2 : 0.3, 
                        delay: isNewPatient(patient.id) ? 0 : index * 0.03,
                        ease: "easeOut"
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 relative">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse-slow"></div>
                            <div className="absolute inset-[2px] rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                {patient.first_name.charAt(0)}
                                {patient.last_name.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {patient.first_name} {patient.last_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                              <span className="flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>
                                {patient.registration_number}
                              </span>
                              {patient.blood_group && (
                                <span className="ml-3 flex items-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                                  {patient.blood_group}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isNewPatient(patient.id) && (
                          <motion.span
                            initial={{ opacity: 1, scale: 1.2 }}
                            animate={{ opacity: [1, 0.7, 1], scale: 1 }}
                            transition={{ repeat: 5, duration: 1.5 }}
                            className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-100 to-purple-100 text-purple-800 dark:from-indigo-900/30 dark:to-purple-900/30 dark:text-purple-300"
                          >
                            New
                          </motion.span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {calculateAge(patient.date_of_birth)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            patient.gender === "MALE"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30"
                              : patient.gender === "FEMALE"
                              ? "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border border-pink-200 dark:border-pink-800/30"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                          }`}
                        >
                          {patient.gender}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {patient.phone_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {patient.email || "--"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
                          <FiCheck className="mr-1 h-3 w-3" />
                          Registered
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-1.5">
                          <motion.button
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => fetchPatientDetail(patient.id)}
                            className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors duration-200 shadow-sm"
                            title="View Details"
                            aria-label={`View details for ${patient.first_name} ${patient.last_name}`}
                          >
                            <FiEye className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openEditModal(patient.id)}
                            className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors duration-200 shadow-sm"
                            title="Edit Record"
                            aria-label={`Edit record for ${patient.first_name} ${patient.last_name}`}
                          >
                            <FiEdit2 className="h-4 w-4" />
                          </motion.button>
                          <div className="group relative">
                            <div className="absolute z-20 hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded shadow-lg">
                              Premium Features
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              const confirmed = await confirmDelete(patient.id);
                              if (confirmed) deletePatient(patient.id);
                            }}
                            className="flex items-center justify-center h-8 w-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30 transition-colors duration-200 shadow-sm"
                            title="Delete Record"
                            aria-label={`Delete record for ${patient.first_name} ${patient.last_name}`}
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Enhanced Pagination Controls */}
          {pagination.total > 0 && (
            <div className="bg-gray-50/80 dark:bg-gray-800/80 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Showing{" "}
                    <span className="font-medium">
                      {(pagination.page - 1) * pagination.pageSize + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(
                        pagination.page * pagination.pageSize,
                        pagination.total
                      )}
                    </span>{" "}
                    of <span className="font-medium">{pagination.total}</span>{" "}
                    results
                  </p>
                </div>
                <div className="hidden sm:block">
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm space-x-1"
                    aria-label="Pagination"
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                      }
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      aria-label="Previous page"
                    >
                      <FiArrowLeft className="h-4 w-4" />
                    </motion.button>

                    {/* Dynamic page numbers */}
                    {getPageNumbers().map((pageNum, idx) => (
                      <React.Fragment key={idx}>
                        {pageNum === "..." ? (
                          <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                            ...
                          </span>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              setPagination((prev) => ({ ...prev, page: pageNum }))
                            }
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg ${
                              pagination.page === pageNum
                                ? "z-10 border-indigo-500 dark:border-indigo-600 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-600 dark:text-indigo-300"
                                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                            } transition-colors duration-200`}
                            aria-label={`Page ${pageNum}`}
                            aria-current={
                              pagination.page === pageNum ? "page" : undefined
                            }
                          >
                            {pageNum}
                          </motion.button>
                        )}
                      </React.Fragment>
                    ))}

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                      }
                      disabled={
                        pagination.page === pagination.pages ||
                        pagination.pages === 0
                      }
                      className="relative inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      aria-label="Next page"
                    >
                      <FiArrowRight className="h-4 w-4" />
                    </motion.button>
                  </nav>
                </div>

                {/* Mobile pagination */}
                <div className="flex sm:hidden space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                    }
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    aria-label="Previous page"
                  >
                    <FiArrowLeft className="h-4 w-4 mr-1" />
                    Prev
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                    }
                    disabled={
                      pagination.page === pagination.pages || pagination.pages === 0
                    }
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    aria-label="Next page"
                  >
                    Next
                    <FiArrowRight className="h-4 w-4 ml-1" />
                  </motion.button>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Patient Detail Modal */}
        <AnimatePresence>
          {viewPatientDetail && patientDetailData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center px-4 py-6"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                onClick={() => setViewPatientDetail(null)}
              />

              <motion.div
                id="patient-detail-modal"
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl transform w-full max-w-4xl mx-auto border border-gray-100 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header with gradient background */}
                <div className="bg-gradient-to-r from-teal-500 via-blue-500 to-indigo-600 text-white px-6 py-4 flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium flex items-center">
                    <FiFileText className="h-5 w-5 mr-2" />
                    Patient Details: {patientDetailData.first_name} {patientDetailData.last_name}
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setViewPatientDetail(null)}
                    className="bg-white/20 rounded-full p-1.5 text-white hover:bg-white/30 focus:outline-none transition-all duration-200"
                    aria-label="Close modal"
                  >
                    <FiX className="h-5 w-5" />
                  </motion.button>
                </div>

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Patient Summary */}
                    <div className="lg:col-span-1">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 h-full">
                        <div className="flex items-center space-x-4 mb-6">
                          <div className="w-16 h-16 relative flex-shrink-0">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 animate-pulse-slow"></div>
                            <div className="absolute inset-[3px] rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                              <span className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                                {patientDetailData.first_name.charAt(0)}
                                {patientDetailData.last_name.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                              {patientDetailData.first_name} {patientDetailData.last_name}
                            </h4>
                            <p className="text-gray-500 dark:text-gray-400">
                              ID: {patientDetailData.registration_number}
                            </p>
                            <div className="mt-1.5 flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                patientDetailData.gender === "MALE"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30"
                                  : patientDetailData.gender === "FEMALE"
                                  ? "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border border-pink-200 dark:border-pink-800/30"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                              }`}>
                                {patientDetailData.gender}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-start">
                            <FiCalendar className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                            <div className="ml-3">
                              <p className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</p>
                              <p className="text-base font-medium text-gray-900 dark:text-white">
                                {new Date(patientDetailData.date_of_birth).toLocaleDateString()} 
                                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                  ({calculateAge(patientDetailData.date_of_birth)} years)
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start">
                            <FiPhone className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                            <div className="ml-3">
                              <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                              <p className="text-base font-medium text-gray-900 dark:text-white">
                                {patientDetailData.phone_number}
                              </p>
                            </div>
                          </div>

                          {patientDetailData.email && (
                            <div className="flex items-start">
                              <FiMail className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                              <div className="ml-3">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                                <p className="text-base font-medium text-gray-900 dark:text-white">
                                  {patientDetailData.email}
                                </p>
                              </div>
                            </div>
                          )}

                          {patientDetailData.address && (
                            <div className="flex items-start">
                              <FiInfo className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                              <div className="ml-3">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                                <p className="text-base font-medium text-gray-900 dark:text-white">
                                  {patientDetailData.address}
                                </p>
                              </div>
                            </div>
                          )}

                          {patientDetailData.blood_group && (
                            <div className="flex items-start">
                              <FiHeart className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                              <div className="ml-3">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Blood Group</p>
                                <p className="text-base font-medium text-gray-900 dark:text-white">
                                  {patientDetailData.blood_group}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-start">
                            <FiAward className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                            <div className="ml-3">
                              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                              <p className="text-base font-medium">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
                                  <FiCheck className="mr-1 h-3 w-3" />
                                  Registered
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Medical Info */}
                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Emergency Contact */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5">
                        <h5 className="text-base font-bold text-gray-900 dark:text-white flex items-center mb-4">
                          <FiPhone className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" />
                          Emergency Contact
                        </h5>
                        {patientDetailData.emergency_contact_name || patientDetailData.emergency_contact_phone ? (
                          <div className="space-y-4">
                            {patientDetailData.emergency_contact_name && (
                              <div className="flex items-start">
                                <FiUser className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div className="ml-3">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                                  <p className="text-base font-medium text-gray-900 dark:text-white">
                                    {patientDetailData.emergency_contact_name}
                                  </p>
                                </div>
                              </div>
                            )}
                            {patientDetailData.emergency_contact_phone && (
                              <div className="flex items-start">
                                <FiPhone className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div className="ml-3">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                                  <p className="text-base font-medium text-gray-900 dark:text-white">
                                    {patientDetailData.emergency_contact_phone}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">No emergency contact information provided</p>
                        )}
                      </div>

                      {/* Allergies */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5">
                        <h5 className="text-base font-bold text-gray-900 dark:text-white flex items-center mb-4">
                          <FiAlertCircle className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" />
                          Allergies
                        </h5>
                        {patientDetailData.allergies && patientDetailData.allergies.length > 0 ? (
                          <div className="space-y-2">
                            {patientDetailData.allergies.map((allergy, idx) => (
                              <div key={idx} className="flex items-center bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-800/30">
                                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                <span className="text-red-800 dark:text-red-300">{allergy}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">No known allergies</p>
                        )}
                      </div>

                      {/* Medical History */}
                      <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5">
                        <h5 className="text-base font-bold text-gray-900 dark:text-white flex items-center mb-4">
                          <FiFileText className="h-5 w-5 text-indigo-500 dark:text-indigo-400 mr-2" />
                          Medical History
                        </h5>
                        {patientDetailData.medical_history && Object.keys(patientDetailData.medical_history).length > 0 ? (
                          <div className="space-y-4">
                            {Object.entries(patientDetailData.medical_history).map(([category, conditions]) => (
                              <div key={category} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                                <h6 className="text-sm font-semibold text-gray-900 dark:text-white capitalize mb-2">{category}</h6>
                                <div className="space-y-1 pl-2">
                                  {Array.isArray(conditions) ? (
                                    conditions.map((condition, idx) => (
                                      <div key={idx} className="flex items-start">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-1.5 mr-2"></div>
                                        <span className="text-gray-700 dark:text-gray-300">{condition}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex items-start">
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-1.5 mr-2"></div>
                                      <span className="text-gray-700 dark:text-gray-300">{conditions}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 text-sm">No medical history recorded</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex justify-end border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openEditModal(patientDetailData.id)}
                      className="px-4 py-2.5 inline-flex items-center bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/30 rounded-xl text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-all duration-200"
                    >
                      <FiEdit2 className="mr-1.5 h-4 w-4" />
                      Edit Patient
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setViewPatientDetail(null)}
                      className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-all duration-200"
                    >
                      Close
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enhanced Patient Registration/Edit Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center px-4"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                onClick={() => setIsModalOpen(false)}
              />

              <motion.div
                ref={modalRef}
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-2xl transform w-full max-w-5xl my-6 mx-auto border border-gray-100 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header with gradient background */}
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white px-6 py-4 flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-medium flex items-center">
                    {isEditMode ? (
                      <>
                        <FiEdit2 className="h-5 w-5 mr-2" />
                        Edit Patient
                      </>
                    ) : (
                      <>
                        <FiUserPlus className="h-5 w-5 mr-2" />
                        Register New Patient
                      </>
                    )}
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsModalOpen(false)}
                    className="bg-white/20 rounded-full p-1.5 text-white hover:bg-white/30 focus:outline-none transition-all duration-200"
                    aria-label="Close modal"
                  >
                    <FiX className="h-5 w-5" />
                  </motion.button>
                </div>

                {/* Form error message */}
                {formError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-300 rounded-lg flex items-center"
                  >
                    <FiAlertCircle className="h-5 w-5 mr-2 text-red-500 dark:text-red-400 flex-shrink-0" />
                    <span>{formError}</span>
                  </motion.div>
                )}

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Personal Information Column */}
                      <div className="space-y-5">
                        <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                          <FiUser className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Personal Information
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                              First Name{" "}
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative group">
                              <div
                                className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-opacity ${
                                  fieldFocus.first_name
                                    ? "opacity-100 text-indigo-500 dark:text-indigo-400"
                                    : "opacity-70 text-gray-400"
                                }`}
                              >
                                <FiUser className="h-5 w-5" />
                              </div>
                              <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                onFocus={() => handleFocus("first_name")}
                                onBlur={() => handleBlur("first_name")}
                                className={`block w-full pl-10 rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ${
                                  validationErrors.first_name
                                    ? "ring-red-500 focus:ring-red-500"
                                    : formTouched.first_name && formData.first_name
                                    ? "ring-green-500 focus:ring-green-500"
                                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                                } focus:ring-2 focus:ring-inset py-2.5 transition-all duration-200`}
                                required
                                aria-invalid={
                                  validationErrors.first_name ? "true" : "false"
                                }
                                aria-describedby={
                                  validationErrors.first_name
                                    ? "first_name-error"
                                    : undefined
                                }
                              />
                              {validationErrors.first_name && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  id="first_name-error"
                                  className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
                                >
                                  <FiAlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                  {validationErrors.first_name}
                                </motion.div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                              Last Name{" "}
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div
                                className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-opacity ${
                                  fieldFocus.last_name
                                    ? "opacity-100 text-indigo-500 dark:text-indigo-400"
                                    : "opacity-70 text-gray-400"
                                }`}
                              >
                                <FiUser className="h-5 w-5" />
                              </div>
                              <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                onFocus={() => handleFocus("last_name")}
                                onBlur={() => handleBlur("last_name")}
                                className={`block w-full pl-10 rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ${
                                  validationErrors.last_name
                                    ? "ring-red-500 focus:ring-red-500"
                                    : formTouched.last_name && formData.last_name
                                    ? "ring-green-500 focus:ring-green-500"
                                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                                } focus:ring-2 focus:ring-inset py-2.5 transition-all duration-200`}
                                required
                                aria-invalid={
                                  validationErrors.last_name ? "true" : "false"
                                }
                                aria-describedby={
                                  validationErrors.last_name
                                    ? "last_name-error"
                                    : undefined
                                }
                              />
                              {validationErrors.last_name && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  id="last_name-error"
                                  className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
                                >
                                  <FiAlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                  {validationErrors.last_name}
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                              Date of Birth{" "}
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <div
                                className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-opacity ${
                                  fieldFocus.date_of_birth
                                    ? "opacity-100 text-indigo-500 dark:text-indigo-400"
                                    : "opacity-70 text-gray-400"
                                }`}
                              >
                                <FiCalendar className="h-5 w-5" />
                              </div>
                              <input
                                type="date"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                onFocus={() => handleFocus("date_of_birth")}
                                onBlur={() => handleBlur("date_of_birth")}
                                className={`block w-full pl-10 rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ${
                                  validationErrors.date_of_birth
                                    ? "ring-red-500 focus:ring-red-500"
                                    : formTouched.date_of_birth && formData.date_of_birth
                                    ? "ring-green-500 focus:ring-green-500"
                                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                                } focus:ring-2 focus:ring-inset py-2.5 transition-all duration-200`}
                                required
                                aria-invalid={
                                  validationErrors.date_of_birth
                                    ? "true"
                                    : "false"
                                }
                                aria-describedby={
                                  validationErrors.date_of_birth
                                    ? "dob-error"
                                    : undefined
                                }
                              />
                              {validationErrors.date_of_birth && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  id="dob-error"
                                  className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
                                >
                                  <FiAlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                  {validationErrors.date_of_birth}
                                </motion.div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                              Gender <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="relative">
                              <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                onFocus={() => handleFocus("gender")}
                                onBlur={() => handleBlur("gender")}
                                className={`block w-full rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ${
                                  validationErrors.gender
                                    ? "ring-red-500 focus:ring-red-500"
                                    : formTouched.gender && formData.gender
                                    ? "ring-green-500 focus:ring-green-500"
                                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                                } focus:ring-2 focus:ring-inset py-2.5 transition-all duration-200`}
                                required
                                aria-invalid={
                                  validationErrors.gender ? "true" : "false"
                                }
                                aria-describedby={
                                  validationErrors.gender
                                    ? "gender-error"
                                    : undefined
                                }
                              >
                                <option value="">Select gender</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                              </select>
                              {validationErrors.gender && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  id="gender-error"
                                  className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
                                >
                                  <FiAlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                  {validationErrors.gender}
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                            Phone Number{" "}
                            <span className="text-red-500 ml-1">*</span>
                          </label>
                          <div className="relative">
                            <div
                              className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-opacity ${
                                fieldFocus.phone_number
                                  ? "opacity-100 text-indigo-500 dark:text-indigo-400"
                                  : "opacity-70 text-gray-400"
                              }`}
                            >
                              <FiPhone className="h-5 w-5" />
                            </div>
                            <input
                              type="tel"
                              name="phone_number"
                              value={formData.phone_number}
                              onChange={handleChange}
                              onFocus={() => handleFocus("phone_number")}
                              onBlur={() => handleBlur("phone_number")}
                              className={`block w-full pl-10 rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ${
                                validationErrors.phone_number
                                  ? "ring-red-500 focus:ring-red-500"
                                  : formTouched.phone_number && formData.phone_number
                                  ? "ring-green-500 focus:ring-green-500"
                                  : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                              } focus:ring-2 focus:ring-inset py-2.5 transition-all duration-200`}
                              placeholder="+1234567890"
                              required
                              aria-invalid={
                                validationErrors.phone_number ? "true" : "false"
                              }
                              aria-describedby={
                                validationErrors.phone_number
                                  ? "phone-error"
                                  : undefined
                              }
                            />
                            {validationErrors.phone_number && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                id="phone-error"
                                className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
                              >
                                <FiAlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                {validationErrors.phone_number}
                              </motion.div>
                            )}
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center pl-2">
                              <FiInfo className="h-3 w-3 mr-1 flex-shrink-0" />
                              Format: +1234567890 (country code followed by
                              number)
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email
                            <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                              optional
                            </span>
                          </label>
                          <div className="relative">
                            <div
                              className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-opacity ${
                                fieldFocus.email
                                  ? "opacity-100 text-indigo-500 dark:text-indigo-400"
                                  : "opacity-70 text-gray-400"
                              }`}
                            >
                              <FiMail className="h-5 w-5" />
                            </div>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              onFocus={() => handleFocus("email")}
                              onBlur={() => handleBlur("email")}
                              placeholder="patient@example.com"
                              className={`block w-full pl-10 rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ${
                                validationErrors.email
                                  ? "ring-red-500 focus:ring-red-500"
                                  : formTouched.email && formData.email
                                  ? "ring-green-500 focus:ring-green-500"
                                  : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                              } focus:ring-2 focus:ring-inset py-2.5 transition-all duration-200`}
                              aria-invalid={
                                validationErrors.email ? "true" : "false"
                              }
                              aria-describedby={
                                validationErrors.email ? "email-error" : undefined
                              }
                            />
                            {validationErrors.email && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                id="email-error"
                                className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
                              >
                                <FiAlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                {validationErrors.email}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Medical Information Column */}
                      <div className="space-y-5">
                        <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                          <FiInfo className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Medical Information
                          </h4>
                        </div>

                        <div className="space-y-1">
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                            Emergency Contact
                            <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                              optional
                            </span>
                          </label>
                          <div className="relative">
                            <div
                              className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-opacity ${
                                fieldFocus.emergency_contact_name
                                  ? "opacity-100 text-indigo-500 dark:text-indigo-400"
                                  : "opacity-70 text-gray-400"
                              }`}
                            >
                              <FiUser className="h-5 w-5" />
                            </div>
                            <input
                              type="text"
                              name="emergency_contact_name"
                              value={formData.emergency_contact_name}
                              onChange={handleChange}
                              onFocus={() =>
                                handleFocus("emergency_contact_name")
                              }
                              onBlur={() => handleBlur("emergency_contact_name")}
                              placeholder="Full name of emergency contact"
                              className="block w-full pl-10 rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:focus:ring-indigo-400 py-2.5 transition-all duration-200"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                            Emergency Phone
                            <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                              optional
                            </span>
                          </label>
                          <div className="relative">
                            <div
                              className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-opacity ${
                                fieldFocus.emergency_contact_phone
                                  ? "opacity-100 text-indigo-500 dark:text-indigo-400"
                                  : "opacity-70 text-gray-400"
                              }`}
                            >
                              <FiPhone className="h-5 w-5" />
                            </div>
                            <input
                              type="tel"
                              name="emergency_contact_phone"
                              value={formData.emergency_contact_phone}
                              onChange={handleChange}
                              onFocus={() =>
                                handleFocus("emergency_contact_phone")
                              }
                              onBlur={() => handleBlur("emergency_contact_phone")}
                              placeholder="+1234567890"
                              className={`block w-full pl-10 rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ${
                                validationErrors.emergency_contact_phone
                                  ? "ring-red-500 focus:ring-red-500"
                                  : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                              } focus:ring-2 focus:ring-inset py-2.5 transition-all duration-200`}
                              aria-invalid={
                                validationErrors.emergency_contact_phone
                                  ? "true"
                                  : "false"
                              }
                              aria-describedby={
                                validationErrors.emergency_contact_phone
                                  ? "emergency-phone-error"
                                  : undefined
                              }
                            />
                            {validationErrors.emergency_contact_phone && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                id="emergency-phone-error"
                                className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"
                              >
                                <FiAlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                {validationErrors.emergency_contact_phone}
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Improved Medical History Input */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                              Medical History
                              <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                optional
                              </span>
                            </label>
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={addMedicalHistoryItem}
                              className="flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                            >
                              <FiPlusCircle className="mr-1 h-3.5 w-3.5" />
                              Add Condition
                            </motion.button>
                          </div>
                          
                          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                            {medicalHistoryItems.length === 0 ? (
                              <div className="text-center py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                                <FiClipboard className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400">No medical history records</p>
                                <button
                                  type="button"
                                  onClick={addMedicalHistoryItem}
                                  className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                >
                                  Add medical condition
                                </button>
                              </div>
                            ) : (
                              medicalHistoryItems.map((item, index) => (
                                <div 
                                  key={index} 
                                  className="flex gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm"
                                >
                                  <div className="flex-1 grid grid-cols-2 gap-2">
                                    <div>
                                      <input
                                        type="text"
                                        placeholder="Category (e.g. condition, surgery)"
                                        value={item.category}
                                        onChange={(e) => updateMedicalHistoryItem(index, 'category', e.target.value)}
                                        className="w-full text-sm rounded-lg border-0 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:focus:ring-indigo-400 py-2"
                                      />
                                    </div>
                                    <div>
                                      <input
                                        type="text"
                                        placeholder="Description"
                                        value={item.condition}
                                        onChange={(e) => updateMedicalHistoryItem(index, 'condition', e.target.value)}
                                        className="w-full text-sm rounded-lg border-0 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:focus:ring-indigo-400 py-2"
                                      />
                                    </div>
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => removeMedicalHistoryItem(index)}
                                    className="flex-shrink-0 self-center p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    aria-label="Remove condition"
                                  >
                                    <FiMinusCircle className="h-4 w-4" />
                                  </motion.button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Improved Allergies Input */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                              Allergies
                              <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                optional
                              </span>
                            </label>
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={addAllergyItem}
                              className="flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                            >
                              <FiPlusCircle className="mr-1 h-3.5 w-3.5" />
                              Add Allergy
                            </motion.button>
                          </div>
                          
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {allergiesItems.length === 0 ? (
                              <div className="text-center py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                                <FiAlertCircle className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400">No allergies recorded</p>
                                <button
                                  type="button"
                                  onClick={addAllergyItem}
                                  className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                                >
                                  Add allergy
                                </button>
                              </div>
                            ) : (
                              allergiesItems.map((item, index) => (
                                <div 
                                  key={index} 
                                  className="flex gap-2 bg-red-50 dark:bg-red-900/10 p-2.5 rounded-lg border border-red-100 dark:border-red-800/20"
                                >
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      placeholder="Allergy name (e.g. penicillin)"
                                      value={item.name}
                                      onChange={(e) => updateAllergyItem(index, e.target.value)}
                                      className="w-full text-sm rounded-lg border-0 bg-white/80 dark:bg-gray-800/70 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-red-200 dark:ring-red-800/30 focus:ring-2 focus:ring-inset focus:ring-red-500 dark:focus:ring-red-500 py-2"
                                    />
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => removeAllergyItem(index)}
                                    className="flex-shrink-0 self-center p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                                    aria-label="Remove allergy"
                                  >
                                    <FiMinusCircle className="h-4 w-4" />
                                  </motion.button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                            Blood Group
                            <span className="ml-1.5 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                              optional
                            </span>
                          </label>
                          <div className="relative">
                            <select
                              name="blood_group"
                              value={formData.blood_group}
                              onChange={handleChange}
                              onFocus={() => handleFocus("blood_group")}
                              onBlur={() => handleBlur("blood_group")}
                              className={`block w-full rounded-xl border-0 bg-gray-50 dark:bg-gray-700 text-base text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500 dark:focus:ring-indigo-400 py-2.5 transition-all duration-200 ${fieldFocus.blood_group ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''}`}
                            >
                              <option value="">Select blood group</option>
                              <option value="A+">A+</option>
                              <option value="A-">A-</option>
                              <option value="B+">B+</option>
                              <option value="B-">B-</option>
                              <option value="AB+">AB+</option>
                              <option value="AB-">AB-</option>
                              <option value="O+">O+</option>
                              <option value="O-">O-</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-all duration-200"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: isEditMode || formValid ? 1.02 : 1 }}
                        whileTap={{ scale: isEditMode || formValid ? 0.98 : 1 }}
                        type="submit"
                        disabled={!isEditMode && !formValid || isSubmitting}
                        className={`inline-flex items-center justify-center px-5 py-2.5 rounded-xl shadow-md text-sm font-medium text-white ${
                          isEditMode || formValid
                            ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                            : "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-all duration-200 min-w-[120px]`}
                      >
                        {isSubmitting ? (
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        ) : null}
                        {isEditMode ? "Update Patient" : "Register Patient"}
                      </motion.button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
        
        .network-animation {
          animation: network-pulse 10s linear infinite;
        }
        
        @keyframes network-pulse {
          0% { opacity: 0.3; }
          50% { opacity: 0.7; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default RegisterPatient;
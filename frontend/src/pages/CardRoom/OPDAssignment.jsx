import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import axios from "axios";

// Custom icons with optimized styling
const Icons = {
  Users: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  Refresh: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  UserCheck: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
    </svg>
  ),
  AlertCircle: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </svg>
  ),
  Search: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  Check: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  Close: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  ),
  ThemeMoon: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  ),
  ThemeSun: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  ),
  Filter: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
    </svg>
  ),
  Shield: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ),
  Clock: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  Heart: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  ),
  BloodDrop: props => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className || "w-5 h-5"}>
      <path d="M12 2L7.99999 9.75C6.24999 13.125 7.49999 17.25 10.875 19C11.25 19.125 11.625 19.25 12 19.25C16.125 19.25 19.25 16.125 19.25 12C19.25 11.625 19.125 11.25 19 10.875C17.25 7.5 13.75 6.25 10.5 8C9.74999 8.375 9.12499 9 8.74999 9.75L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.5 19V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 22H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Checkmark: props => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className || "w-5 h-5"}>
      <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.75 12L10.58 14.83L16.25 9.17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Hospital: props => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={props.className || "w-5 h-5"}>
      <path d="M3 21H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 21V5C5 3.9 5.9 3 7 3H17C18.1 3 19 3.9 19 5V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 21V17H15V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 9.01L9.01 8.99" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 9.01L15.01 8.99" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 13.01L9.01 12.99" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 13.01L15.01 12.99" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// Toast notification component
const Toast = ({ message, type, onClose }) => {
  const variants = {
    initial: { opacity: 0, y: -50, scale: 0.5 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } },
    exit: { opacity: 0, y: -30, scale: 0.9, transition: { duration: 0.2 } }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getToastClasses = () => {
    const baseClasses = "fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-xl backdrop-blur-lg border border-white/10";
    switch(type) {
      case 'success': 
        return `${baseClasses} bg-gradient-to-r from-teal-500/95 to-emerald-600/95 text-white dark:from-teal-600/95 dark:to-emerald-700/95`;
      case 'error':
        return `${baseClasses} bg-gradient-to-r from-rose-500/95 to-red-600/95 text-white dark:from-rose-600/95 dark:to-red-700/95`;
      case 'warning':
        return `${baseClasses} bg-gradient-to-r from-amber-500/95 to-orange-600/95 text-white dark:from-amber-600/95 dark:to-orange-700/95`;
      default:
        return `${baseClasses} bg-gradient-to-r from-teal-500/95 to-blue-600/95 text-white dark:from-teal-600/95 dark:to-blue-700/95`;
    }
  };

  const getIcon = () => {
    switch(type) {
      case 'success': return <Icons.Check className="w-5 h-5" />;
      case 'error': return <Icons.Close className="w-5 h-5" />;
      case 'warning': return <Icons.AlertCircle className="w-5 h-5" />;
      default: return <Icons.Check className="w-5 h-5" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={getToastClasses()}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center">
          <div className="flex items-center justify-center w-8 h-8 mr-3 rounded-full bg-white/20">
            {getIcon()}
          </div>
          <p className="font-medium">{message}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="ml-auto pl-3 text-white/80 hover:text-white"
          aria-label="Close notification"
        >
          <Icons.Close className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};

// Skeleton loader components
const SkeletonRow = ({ columns = 4 }) => {
  return (
    <tr className="animate-pulse">
      {[...Array(columns)].map((_, i) => (
        <td key={i} className="px-6 py-4 whitespace-nowrap">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </td>
      ))}
    </tr>
  );
};

// Modern non-intrusive loader component
const InitialLoader = ({ isLoading }) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-6 inset-x-0 z-50 flex justify-center pointer-events-none"
        >
          <motion.div 
            className="px-6 py-3 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg shadow-2xl border border-teal-100 dark:border-teal-900/30 flex items-center gap-3"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 300 }}
          >
            <div className="relative w-6 h-6">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <defs>
                  <linearGradient id="loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <g fill="none" stroke="url(#loader-gradient)" strokeWidth="8" strokeLinecap="round">
                  <motion.circle 
                    cx="50" cy="50" r="40"
                    initial={{ pathLength: 0, rotate: 0 }}
                    animate={{ pathLength: [0, 0.5, 0], rotate: 360 }}
                    transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
                  />
                </g>
              </svg>
            </div>
            <motion.span 
              className="text-base font-medium bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent dark:from-teal-400 dark:to-blue-400"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Loading healthcare data...
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// No Results Animation
const EmptyState = ({ message, icon }) => {
  return (
    <motion.div 
      className="flex flex-col items-center justify-center py-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-gray-300 dark:text-gray-600 mb-4"
        animate={{ 
          scale: [1, 1.05, 1],
          opacity: [0.8, 1, 0.8]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      >
        {icon || <Icons.AlertCircle className="w-14 h-14" />}
      </motion.div>
      <motion.p 
        className="text-gray-500 dark:text-gray-400 text-center max-w-md"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.p>
    </motion.div>
  );
};

// Success Message Component
const SuccessMessage = ({ message }) => {
  return (
    <motion.div 
      className="rounded-xl overflow-hidden shadow-lg bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border border-teal-100 dark:border-teal-800/30 mb-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <div className="p-4 flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          <motion.div 
            className="flex items-center justify-center h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-800/50 text-teal-600 dark:text-teal-300"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, delay: 0.2 }}
          >
            <Icons.Check className="h-5 w-5" />
          </motion.div>
        </div>
        <div className="ml-4 flex-1">
          <motion.p 
            className="text-base font-medium text-teal-800 dark:text-teal-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Success!
          </motion.p>
          <motion.p 
            className="mt-1 text-sm text-teal-700 dark:text-teal-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {message}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
};

function OPDAssignment() {
  const [doctors, setDoctors] = useState([]);
  const [waitingPatients, setWaitingPatients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState({
    doctors: false,
    patients: false,
    assignment: false,
    assignments: false,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: null,
    doctor_id: null,
    patient_id: null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [newAssignments, setNewAssignments] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const PAGE_SIZE = 10;

  const mainContentRef = useRef(null);

  // Initialize dark mode based on user preference
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const darkModeListener = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e) => {
      setDarkMode(e.matches);
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    darkModeListener.addEventListener('change', handleDarkModeChange);
    return () => darkModeListener.removeEventListener('change', handleDarkModeChange);
  }, []);

  // Initial loading animation - limited to 1 second
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Custom toast function
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Fetch doctors from the system
  const fetchDoctors = async () => {
    setLoading((prev) => ({ ...prev, doctors: true }));
    try {
      const response = await axios.get("http://localhost:8022/users/doctors");
      const doctorsData = response.data || [];
      setDoctors(
        doctorsData.map((doctor) => ({
          ...doctor,
          availability: doctor.is_available ? "Available" : "Not Available",
        }))
      );
    } catch (error) {
      console.error("Error fetching doctors:", error);
      showToast("Failed to fetch doctors", "error");
    } finally {
      setLoading((prev) => ({ ...prev, doctors: false }));
    }
  };

  const fetchWaitingPatients = async () => {
    setLoading((prev) => ({ ...prev, patients: true }));
    try {
      const response = await axios.get(
        "http://localhost:8023/api/patients?page=1&page_size=50"
      );
      const patientsData = response.data.data || [];
      setWaitingPatients(patientsData);
    } catch (error) {
      console.error("Error fetching patients:", error);
      showToast("Failed to fetch patients", "error");
    } finally {
      setLoading((prev) => ({ ...prev, patients: false }));
    }
  };

  const fetchAssignments = async () => {
    setLoading((prev) => ({ ...prev, assignments: true }));
    try {
      const params = new URLSearchParams({
        page: 1,
        page_size: 1000, // Fetch all for client-side pagination
        ...filters,
      });

      const response = await axios.get(
        `http://localhost:8023/api/opd-assignments?page=${page}&page_size=20`
      );
      setAssignments(response.data.data || []);
    } catch (error) {
      console.error("Error fetching OPD assignments:", error);
      showToast("Failed to fetch assignments", "error");
    } finally {
      setLoading((prev) => ({ ...prev, assignments: false }));
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchWaitingPatients();
    fetchAssignments();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [filters]);

  // Client-side filtering and pagination
  const filteredData = assignments.filter((assignment) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      assignment.patient_name?.toLowerCase().includes(searchLower) ||
      assignment.doctor_name?.toLowerCase().includes(searchLower) ||
      assignment.status?.toLowerCase().includes(searchLower) ||
      assignment.id?.toLowerCase().includes(searchLower)
    );
  });

  const paginatedData = filteredData.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const totalPagesCalc = Math.ceil(filteredData.length / PAGE_SIZE);

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor.id === selectedDoctor ? null : doctor.id);
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient.id === selectedPatient ? null : patient.id);
  };

  const handleAssignment = async () => {
    if (!selectedDoctor || !selectedPatient) {
      showToast("Please select both a doctor and a patient.", "warning");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, assignment: true }));
      const doctor = doctors.find((d) => d.id === selectedDoctor);
      const patient = waitingPatients.find((p) => p.id === selectedPatient);

      const response = await axios.post(
        "http://localhost:8023/api/opd-assignments/",
        {
          doctor_id: selectedDoctor,
          patient_id: selectedPatient,
        }
      );

      setSuccessMessage(
        `Successfully assigned ${patient.first_name} ${patient.last_name} to Dr. ${doctor.full_name}`
      );
      setTimeout(() => setSuccessMessage(""), 5000);

      // Add to new assignments
      setNewAssignments((prev) => {
        const newSet = new Set(prev);
        newSet.add(response.data.id);
        return newSet;
      });

      // Remove new status after 5 minutes
      setTimeout(() => {
        setNewAssignments((prev) => {
          const newSet = new Set(prev);
          newSet.delete(response.data.id);
          return newSet;
        });
      }, 300000);

      showToast("Patient successfully assigned to doctor", "success");
      await Promise.all([fetchAssignments(), fetchDoctors(), fetchWaitingPatients()]);
      setSelectedDoctor(null);
      setSelectedPatient(null);
    } catch (error) {
      console.error("Error creating assignment:", error);
      showToast(
        error.response?.data?.detail || "Failed to create assignment",
        "error"
      );
    } finally {
      setLoading((prev) => ({ ...prev, assignment: false }));
    }
  };

  const refreshData = () => {
    fetchDoctors();
    fetchWaitingPatients();
    fetchAssignments();
    showToast("Data refreshed successfully", "success");
  };

  const applyFilter = (filterType, value) => {
    setFilters((prev) => ({ ...prev, [filterType]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: null, doctor_id: null, patient_id: null });
    setSearchQuery("");
    setPage(1);
    showToast("Filters cleared", "success");
  };

  const calculateAge = (dob) => {
    if (!dob) return "N/A";
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const age = new Date(difference);
    return Math.abs(age.getUTCFullYear() - 1970);
  };

  // Get blood group with a fallback
  const getBloodGroup = (patient) => {
    return patient.blood_group || patient.bloodGroup || "N/A";
  };

  // Animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'Available':
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      case 'Not Available':
        return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
      case 'PENDING':
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case 'IN_PROGRESS':
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case 'COMPLETED':
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
      case 'CANCELLED':
        return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";
    }
  };

  return (
    <>
      {/* Tailwind Font and Configuration */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        :root {
          --color-primary: 20, 184, 166;
          --color-primary-dark: 13, 148, 136;
          --color-secondary: 59, 130, 246;
          --color-secondary-dark: 37, 99, 235;
          --color-accent: 6, 182, 212;
        }

        html {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          scroll-behavior: smooth;
        }

        body {
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .dark {
          color-scheme: dark;
        }

        .glass-card {
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(var(--color-primary), 0.3);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(var(--color-primary), 0.5);
        }

        /* Card hover effect */
        .hover-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .hover-lift:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
        }

        /* Table hover effect */
        .table-row-hover {
          transition: all 0.2s ease;
        }
        
        .table-row-hover:hover td {
          background-color: rgba(var(--color-primary), 0.05);
        }
        
        /* Custom focus styles */
        .custom-focus:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.3);
        }
        
        /* Selection styles for healthcare app */
        .doctor-card, .patient-card {
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .doctor-card.selected, .patient-card.selected {
          transform: scale(1.02);
        }
        
        .doctor-card.selected::before, .patient-card.selected::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 2px solid rgba(var(--color-primary), 0.7);
          border-radius: inherit;
          pointer-events: none;
        }
        
        .selection-indicator {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0;
          transition: all 0.3s ease;
        }
        
        .doctor-card.selected .selection-indicator, 
        .patient-card.selected .selection-indicator {
          opacity: 1;
        }
        
        /* Medical patterns */
        .medical-pattern {
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2320B8A6' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        
        /* Medical HR */
        .medical-divider {
          height: 1px;
          background: linear-gradient(to right, rgba(var(--color-primary), 0), rgba(var(--color-primary), 0.4), rgba(var(--color-primary), 0));
        }
      `}</style>
    
      <div className="min-h-screen bg-gradient-to-br from-white to-teal-50 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300 medical-pattern">
        {/* Modern non-intrusive loader */}
        <InitialLoader isLoading={initialLoading} />
        
        {/* Toast notifications */}
        {toasts.map(toast => (
          <Toast 
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10" ref={mainContentRef}>
          {/* Modern non-sticky header */}
          <div className="mb-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <motion.div
                  className="flex items-center space-x-4"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg shadow-teal-500/20 dark:shadow-teal-800/20">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.16667 17.3333C4.875 17.3333 3.80208 16.8993 2.94792 16.0312C2.09375 15.1632 1.66667 14.0833 1.66667 12.7917C1.66667 11.6458 2.02431 10.6634 2.73959 9.84375C3.45486 9.02431 4.35417 8.56597 5.4375 8.46875C5.72917 7.17708 6.375 6.13542 7.375 5.34375C8.375 4.55208 9.52431 4.15625 10.8229 4.15625C12.2135 4.15625 13.4062 4.61458 14.401 5.53125C15.3958 6.44792 15.9861 7.58333 16.1719 8.9375C17.276 8.9375 18.1962 9.3125 18.9323 10.0625C19.6684 10.8125 20.0365 11.7396 20.0365 12.8438C20.0365 13.9583 19.6545 14.8924 18.8906 15.6458C18.1267 16.3993 17.1823 16.7743 16.0573 16.7708H12.8333M12.5 12L12.5 22M12.5 12L9 15.5M12.5 12L16 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 to-blue-600 dark:from-teal-400 dark:to-blue-400 tracking-tight">
                      OPD Assignment
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                      Healthcare Professional Portal
                    </p>
                  </div>
                </motion.div>
                
                <div className="flex space-x-3">
                  <motion.div 
                    className="flex items-center px-4 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/30 text-teal-700 dark:text-teal-300 text-sm shadow-sm"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse mr-2"></div>
                    <span className="font-medium">System Online</span>
                  </motion.div>
                
                  <motion.button
                    onClick={refreshData}
                    disabled={loading.doctors || loading.patients || loading.assignments}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ 
                      scale: 1.03, 
                      boxShadow: "0 10px 15px -3px rgba(13, 148, 136, 0.2), 0 4px 6px -2px rgba(13, 148, 136, 0.1)"
                    }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    <Icons.Refresh className={`h-4 w-4 ${(loading.doctors || loading.patients || loading.assignments) ? "animate-spin" : ""}`} />
                    Refresh Data
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
          
          <motion.div 
            className="space-y-6 mt-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Success Message */}
            <AnimatePresence>
              {successMessage && <SuccessMessage message={successMessage} />}
            </AnimatePresence>


            {/* Doctors and Patients Grid */}
            <motion.div 
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              variants={itemVariants}
            >
              {/* Doctors List */}
              <motion.div 
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-slate-200/80 dark:border-slate-700 overflow-hidden hover-lift"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-teal-50 to-slate-50 dark:from-teal-900/20 dark:to-slate-800">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-800/50 text-teal-600 dark:text-teal-300 mr-3">
                      <Icons.UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-white text-lg">Available Doctors</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Click to select a doctor</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => fetchDoctors()}
                    disabled={loading.doctors}
                    className="text-teal-600 dark:text-teal-400 flex items-center text-sm hover:text-teal-800 dark:hover:text-teal-300 transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icons.Refresh className={`mr-1 h-4 w-4 ${loading.doctors ? "animate-spin" : ""}`} />
                    Refresh
                  </motion.button>
                </div>
                <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: "400px" }}>
                  {loading.doctors ? (
                    <div className="p-6">
                      <div className="animate-pulse space-y-4">
                        {[...Array(5)].map((_, idx) => (
                          <div key={idx} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                        ))}
                      </div>
                    </div>
                  ) : doctors.length === 0 ? (
                    <EmptyState 
                      message="No doctors available at the moment. Please refresh or try again later." 
                      icon={<Icons.AlertCircle className="w-14 h-14" />} 
                    />
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {doctors.map((doctor) => (
                        <motion.div
                          key={doctor.id}
                          className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors relative doctor-card ${
                            selectedDoctor === doctor.id ? "selected bg-teal-50/70 dark:bg-teal-900/20" : ""
                          }`}
                          onClick={() => handleDoctorSelect(doctor)}
                          whileHover={{ backgroundColor: darkMode ? "rgba(8, 145, 178, 0.1)" : "rgba(236, 254, 255, 1)" }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-teal-100 to-sky-200 dark:from-teal-900/30 dark:to-sky-800/30 rounded-full flex items-center justify-center shadow-md">
                                <span className="text-base font-medium text-teal-800 dark:text-teal-300">
                                  {doctor.full_name.charAt(0)}
                                </span>
                              </div>
                              <div className="ml-4">
                                <p className="text-base font-semibold text-slate-900 dark:text-white">{doctor.full_name}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-sm text-slate-600 dark:text-slate-300">
                                    {doctor.department || 'General Medicine'}
                                  </span>
                                  <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusClass("Available")}`}>
                                    Available
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="selection-indicator text-teal-600 dark:text-teal-400">
                              <Icons.Checkmark className="w-6 h-6" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Waiting Patients */}
              <motion.div 
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-slate-200/80 dark:border-slate-700 overflow-hidden hover-lift"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-900/20 dark:to-slate-800">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300 mr-3">
                      <Icons.Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-white text-lg">Waiting Patients</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Click to select a patient</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      Total: {waitingPatients.length}
                    </span>
                    <motion.button
                      onClick={() => fetchWaitingPatients()}
                      disabled={loading.patients}
                      className="text-blue-600 dark:text-blue-400 flex items-center text-sm hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Icons.Refresh className={`mr-1 h-4 w-4 ${loading.patients ? "animate-spin" : ""}`} />
                      Refresh
                    </motion.button>
                  </div>
                </div>
                <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: "400px" }}>
                  {loading.patients ? (
                    <div className="p-6">
                      <div className="animate-pulse space-y-4">
                        {[...Array(5)].map((_, idx) => (
                          <div key={idx} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                        ))}
                      </div>
                    </div>
                  ) : waitingPatients.length === 0 ? (
                    <EmptyState 
                      message="No patients waiting for assignment. All patients have been assigned to doctors." 
                      icon={<Icons.AlertCircle className="w-14 h-14" />} 
                    />
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {waitingPatients.map((patient) => (
                        <motion.div
                          key={patient.id}
                          className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors relative patient-card ${
                            selectedPatient === patient.id ? "selected bg-blue-50/70 dark:bg-blue-900/20" : ""
                          }`}
                          onClick={() => handlePatientSelect(patient)}
                          whileHover={{ backgroundColor: darkMode ? "rgba(59, 130, 246, 0.1)" : "rgba(239, 246, 255, 1)" }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-800/30 rounded-full flex items-center justify-center shadow-md">
                                <span className="text-base font-medium text-blue-800 dark:text-blue-300">
                                  {patient.first_name.charAt(0)}
                                </span>
                              </div>
                              <div className="ml-4">
                                <p className="text-base font-semibold text-slate-900 dark:text-white">
                                  {patient.first_name} {patient.last_name}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <div className="flex items-center text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                    <span className="mr-1">ID:</span>
                                    <span className="font-mono">{patient.id.substring(0, 8)}</span>
                                  </div>
                                  <div className="flex items-center text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                    <span className="mr-1">Age:</span>
                                    <span>{calculateAge(patient.date_of_birth)} yrs</span>
                                  </div>
                                  {patient.gender && (
                                    <div className="flex items-center text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                      <span>{patient.gender}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-300">
                                    <Icons.BloodDrop className="w-3 h-3 mr-1" />
                                    <span>{getBloodGroup(patient)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="selection-indicator text-blue-600 dark:text-blue-400">
                              <Icons.Checkmark className="w-6 h-6" />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>

            {/* Assignment Action */}
            <motion.div 
              className="flex justify-center my-12"
              variants={itemVariants}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <motion.button
                onClick={handleAssignment}
                disabled={!selectedDoctor || !selectedPatient || loading.assignment}
                className={`flex items-center px-10 py-4 rounded-xl shadow-xl text-base font-medium text-white transition-all duration-300
                  ${!selectedDoctor || !selectedPatient || loading.assignment
                    ? "bg-slate-400 dark:bg-slate-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 shadow-teal-500/30 hover:shadow-teal-500/40"
                  }`}
                whileHover={!selectedDoctor || !selectedPatient || loading.assignment ? {} : { 
                  scale: 1.03,
                  boxShadow: "0 20px 25px -5px rgba(20, 184, 166, 0.25), 0 10px 10px -5px rgba(20, 184, 166, 0.1)"
                }}
                whileTap={!selectedDoctor || !selectedPatient || loading.assignment ? {} : { scale: 0.97 }}
              >
                {loading.assignment ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Assignment...
                  </div>
                ) : (
                  <>
                    <Icons.UserCheck className="mr-3 h-6 w-6" />
                    Assign Patient to Doctor
                  </>
                )}
              </motion.button>
            </motion.div>

            {/* Medical decorative divider */}
            <div className="medical-divider my-10"></div>

            {/* Assignments Section */}
            <motion.div 
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-slate-200/80 dark:border-slate-700 overflow-hidden hover-lift"
              variants={itemVariants}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mr-3">
                      <Icons.Clock className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-white text-lg">Current OPD Assignments</h3>
                  </div>
                  
                  <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-grow">
                      <input
                        type="text"
                        placeholder="Search assignments..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base transition-colors duration-200 ease-in-out shadow-sm custom-focus"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icons.Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      </div>
                    </div>
                    
                    <select
                      onChange={(e) => applyFilter("status", e.target.value || null)}
                      value={filters.status || ""}
                      className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors duration-200 custom-focus text-base"
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    {(filters.status || filters.doctor_id || filters.patient_id || searchQuery) && (
                      <motion.button
                        onClick={clearFilters}
                        className="px-4 py-2.5 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800/30 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl transition-colors duration-200"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        Clear Filters
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: "500px" }}>
                {loading.assignments ? (
                  <div className="p-6">
                    <div className="animate-pulse space-y-4">
                      {[...Array(5)].map((_, idx) => (
                        <div key={idx} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                      ))}
                    </div>
                  </div>
                ) : paginatedData.length === 0 ? (
                  <EmptyState 
                    message="No assignments found matching your criteria. Try clearing filters or create new assignments." 
                    icon={<Icons.AlertCircle className="w-14 h-14" />} 
                  />
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {paginatedData.map((assignment) => (
                      <motion.div 
                        key={assignment.id} 
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors table-row-hover"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ backgroundColor: darkMode ? "rgba(51, 65, 85, 0.5)" : "rgba(248, 250, 252, 1)" }}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-3 md:space-y-0">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/30 dark:to-indigo-800/30 rounded-full flex items-center justify-center shadow-md mr-3">
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                                {assignment.patient_name?.charAt(0) || 'P'}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{assignment.patient_name}</p>
                                {newAssignments.has(assignment.id) && (
                                  <motion.span 
                                    className="ml-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs px-2 py-0.5 rounded-full inline-flex items-center"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 500 }}
                                  >
                                    <Icons.Check className="h-3 w-3 mr-1" />
                                    New Assignment
                                  </motion.span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                ID: {assignment.id.substring(0, 8)}...
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-teal-100 to-sky-200 dark:from-teal-900/30 dark:to-sky-800/30 rounded-full flex items-center justify-center shadow-md mr-3">
                              <span className="text-sm font-medium text-teal-800 dark:text-teal-300">
                                {assignment.doctor_name?.charAt(0) || 'D'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">Dr. {assignment.doctor_name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Assigned {new Date(assignment.created_at).toLocaleDateString()} at {new Date(assignment.created_at).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          
                          <motion.span
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-medium rounded-full ${getStatusClass(assignment.status)}`}
                            whileHover={{ scale: 1.05 }}
                          >
                            {assignment.status}
                          </motion.span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPagesCalc > 1 && (
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Showing <span className="font-medium">{paginatedData.length}</span> of <span className="font-medium">{filteredData.length}</span> results
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <motion.button
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className={`px-4 py-2 rounded-xl flex items-center space-x-1 text-sm font-medium transition-all duration-200 ${
                        page === 1 
                          ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600" 
                          : "bg-white text-teal-600 hover:bg-teal-50 dark:bg-slate-800 dark:text-teal-400 dark:hover:bg-teal-900/20 shadow-sm hover:shadow"
                      }`}
                      whileHover={page === 1 ? {} : { scale: 1.03 }}
                      whileTap={page === 1 ? {} : { scale: 0.97 }}
                    >
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                      </svg>
                      <span>Previous</span>
                    </motion.button>
                    
                    <div className="flex items-center">
                      {[...Array(Math.min(5, totalPagesCalc))].map((_, idx) => {
                        const pageNumber = page <= 3 
                          ? idx + 1 
                          : page >= totalPagesCalc - 2 
                            ? totalPagesCalc - 4 + idx 
                            : page - 2 + idx;
                        
                        if (pageNumber > totalPagesCalc) return null;
                        
                        return (
                          <motion.button
                            key={pageNumber}
                            onClick={() => setPage(pageNumber)}
                            className={`w-9 h-9 mx-0.5 flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 ${
                              page === pageNumber
                                ? "bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-md" 
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {pageNumber}
                          </motion.button>
                        );
                      })}
                    </div>

                    <motion.button
                      onClick={() => setPage((prev) => Math.min(totalPagesCalc, prev + 1))}
                      disabled={page === totalPagesCalc}
                      className={`px-4 py-2 rounded-xl flex items-center space-x-1 text-sm font-medium transition-all duration-200 ${
                        page === totalPagesCalc 
                          ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600" 
                          : "bg-white text-teal-600 hover:bg-teal-50 dark:bg-slate-800 dark:text-teal-400 dark:hover:bg-teal-900/20 shadow-sm hover:shadow"
                      }`}
                      whileHover={page === totalPagesCalc ? {} : { scale: 1.03 }}
                      whileTap={page === totalPagesCalc ? {} : { scale: 0.97 }}
                    >
                      <span>Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
            
            {/* Footer */}
            <motion.div 
              className="mt-12 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="flex items-center justify-center space-x-1 text-sm text-slate-500 dark:text-slate-400">
                <Icons.Shield className="w-4 h-4" />
                <p>© 2023 MediConnect Healthcare System</p>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Secured Medical Data Management Platform
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
}

export default OPDAssignment;
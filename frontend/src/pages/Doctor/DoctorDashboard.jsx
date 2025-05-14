import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FiUsers, FiCalendar, FiFileText, FiAlertCircle, FiPhone, FiMapPin, FiSearch, FiTrendingUp, FiClock } from 'react-icons/fi';
import { RiMentalHealthLine, RiPulseLine } from 'react-icons/ri';
import { MdOutlineBiotech, MdOutlineHealthAndSafety } from 'react-icons/md';
import { HiOutlineDocumentReport } from 'react-icons/hi';
import { useAuth } from "../../contexts/AuthContext";
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function DoctorDashboard() {
  // User/Auth state
  const { user } = useAuth();
  const doctorId = user.id;
  
  // Data states
  const [activePatients, setActivePatients] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [labRequests, setLabRequests] = useState([]);
  const [patientsTodayCount, setPatientsTodayCount] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  
  // UI states
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isLoadingLabMetrics, setIsLoadingLabMetrics] = useState(true);
  const [isLoadingPatientsTodayCount, setIsLoadingPatientsTodayCount] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [errorMessages, setErrorMessages] = useState({
    patients: null,
    appointments: null,
    labMetrics: null,
    patientsTodayCount: null
  });
  
  // Function to format test type name
  const formatTestTypeName = (name) => {
    if (!name) return 'Unknown';
    const words = name.split(' ');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };
  
  // Lab metrics calculated from lab requests
  const labMetrics = useMemo(() => {
    if (!labRequests.length) return {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      urgent_pending: 0,
      today_new: 0,
      total: 0,
      by_urgency: {
        high: 0,
        medium: 0,
        low: 0
      },
      by_test_type: {}
    };

    const today = new Date().toISOString().split('T')[0];
    
    const metrics = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      urgent_pending: 0,
      today_new: 0,
      total: labRequests.length,
      by_urgency: {
        high: 0,
        medium: 0,
        low: 0
      },
      by_test_type: {}
    };
    
    labRequests.forEach(req => {
      // Count by status
      if (req.status) metrics[req.status.toLowerCase()] = (metrics[req.status.toLowerCase()] || 0) + 1;
      
      // Count high urgency pending
      if (req.status === 'pending' && req.urgency === 'high') {
        metrics.urgent_pending++;
      }
      
      // Count by urgency
      if (req.urgency) metrics.by_urgency[req.urgency.toLowerCase()] = (metrics.by_urgency[req.urgency.toLowerCase()] || 0) + 1;
      
      // Count by test type
      const testType = req.test_type.replace(/_/g, ' ');
      metrics.by_test_type[testType] = (metrics.by_test_type[testType] || 0) + 1;
      
      // Count new requests today
      if (req.created_at && req.created_at.split('T')[0] === today) {
        metrics.today_new++;
      }
    });
    
    return metrics;
  }, [labRequests]);

  // Chart data for lab metrics
  const donutChartData = useMemo(() => {
    return {
      labels: ['High Urgency', 'Medium Urgency', 'Low Urgency'],
      datasets: [
        {
          data: [
            labMetrics.by_urgency?.high || 0,
            labMetrics.by_urgency?.medium || 0, 
            labMetrics.by_urgency?.low || 0
          ],
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(16, 185, 129, 0.8)',
          ],
          borderColor: [
            'rgba(239, 68, 68, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(16, 185, 129, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [labMetrics]);

  // Bar chart data for lab requests by status
  const barChartData = useMemo(() => {
    // Get top test types by count
    const topTestTypes = Object.entries(labMetrics.by_test_type || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => ({ name: formatTestTypeName(entry[0]), count: entry[1] }));
    
    return {
      labels: topTestTypes.map(item => item.name),
      datasets: [
        {
          label: 'Test Requests',
          data: topTestTypes.map(item => item.count),
          backgroundColor: 'rgba(79, 70, 229, 0.8)',
          borderColor: 'rgba(79, 70, 229, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [labMetrics]);
  
  // Function to calculate age from date of birth
  const calculateAge = (dob) => {
    if (!dob) return "N/A";
    
    const birthDate = new Date(dob);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };
  
  // Fetch active patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setIsLoadingPatients(true);
        // Using the patients endpoint you provided - removed limit to fetch all patients
        const response = await axios.get('http://localhost:8024/patients/', {
          params: {
            doctor_id: doctorId,
            skip: 0
          }
        });
        
        if (response.data.success) {
          // Store all patients but only show 5 in the UI
          setActivePatients(response.data.patients.slice(0, 5));
          setTotalPatients(response.data.patients.length);
        } else {
          throw new Error("Failed to fetch patients data");
        }
      } catch (error) {
        console.error("Error fetching patients:", error);
        setErrorMessages(prev => ({
          ...prev,
          patients: error.response?.data?.detail || "Failed to load patients"
        }));
      } finally {
        setIsLoadingPatients(false);
      }
    };
    
    fetchPatients();
  }, [doctorId]);
  
  // Fetch patients created today count
  useEffect(() => {
    const fetchPatientsTodayCount = async () => {
      try {
        setIsLoadingPatientsTodayCount(true);
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const formattedDate = format(today, 'yyyy-MM-dd');
        
        const response = await axios.get('http://localhost:8024/patients/', {
          params: {
            doctor_id: doctorId,
            date_from: formattedDate,
            date_to: formattedDate
          }
        });
        
        if (response.data.success) {
          setPatientsTodayCount(response.data.total || 0);
        } else {
          throw new Error("Failed to fetch patients today count");
        }
      } catch (error) {
        console.error("Error fetching patients today count:", error);
        setErrorMessages(prev => ({
          ...prev,
          patientsTodayCount: error.response?.data?.detail || "Failed to load patients today count"
        }));
      } finally {
        setIsLoadingPatientsTodayCount(false);
      }
    };
    
    fetchPatientsTodayCount();
  }, [doctorId]);
  
  // Fetch upcoming appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setIsLoadingAppointments(true);
        const today = new Date();
        
        // Using the appointments endpoint you provided
        const response = await axios.get('http://localhost:8024/appointments/', {
          params: {
            doctor_id: doctorId,
            date_from: today.toISOString().split('T')[0],
            status: '', 
            limit: 3,
            skip: 0
          }
        });
        
        if (response.data.success) {
          setUpcomingAppointments(response.data.appointments);
        } else {
          throw new Error("Failed to fetch appointment data");
        }
      } catch (error) {
        console.error("Error fetching appointments:", error);
        setErrorMessages(prev => ({
          ...prev,
          appointments: error.response?.data?.detail || "Failed to load appointments"
        }));
      } finally {
        setIsLoadingAppointments(false);
      }
    };
    
    fetchAppointments();
  }, [doctorId]);
  
  // Fetch lab requests
  useEffect(() => {
    const fetchLabRequests = async () => {
      try {
        setIsLoadingLabMetrics(true);
        
        // Using the lab requests endpoint to get metrics
        const response = await axios.get('http://localhost:8024/lab-requests', {
          params: {
            doctor_id: doctorId,
            limit: 100,
            skip: 0
          }
        });
        
        if (response.data.success) {
          setLabRequests(response.data.lab_requests || []);
        } else {
          throw new Error("Failed to fetch lab requests");
        }
      } catch (error) {
        console.error("Error fetching lab requests:", error);
        setErrorMessages(prev => ({
          ...prev,
          labMetrics: error.response?.data?.detail || "Failed to load lab metrics"
        }));
      } finally {
        setIsLoadingLabMetrics(false);
      }
    };
    
    fetchLabRequests();
  }, [doctorId]);
  
  // Helper function to format appointment time
  const formatAppointmentTime = (dateTimeString) => {
    try {
      const date = new Date(dateTimeString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      let dateLabel = "Other";
      if (date.toDateString() === today.toDateString()) {
        dateLabel = "Today";
      } else if (date.toDateString() === tomorrow.toDateString()) {
        dateLabel = "Tomorrow";
      }
      
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return { time: timeString, date: dateLabel };
    } catch (error) {
      console.error("Error formatting date:", error);
      return { time: "Unknown", date: "Unknown" };
    }
  };

  // Function to get status badge styles
  const getStatusBadgeStyle = (status) => {
    switch(status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30';
      case 'inactive':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-300 border border-slate-200 dark:border-slate-700/30';
      case 'pending':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30';
      case 'high':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/30';
      default:
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800/30';
    }
  };

  // Get first character of each word for initials
  const getInitials = (name) => {
    if (!name) return 'NA';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // LiveIndicator component
  const LiveIndicator = () => (
    <div className="flex items-center space-x-1">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 px-4 sm:px-6 lg:px-8 py-8 font-sans transition-colors duration-200 z-0">
      {/* Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Welcome back, Dr. {user.last_name || 'Tamagn Z.'}
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-2">
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/70 transition duration-150"
            >
              <span className="flex items-center">
                <span className="mr-2">🔔</span>
                Notifications
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition duration-150"
            >
              Export Data
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 p-6 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 shadow-sm">
              <FiUsers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="flex items-center text-emerald-600 dark:text-emerald-400 text-sm font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
              <FiTrendingUp className="w-3 h-3 mr-1" />
              +{patientsTodayCount || 0} today
            </span>
          </div>
          <h2 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Patients</h2>
          <div className="flex items-baseline mt-1">
            {isLoadingPatients ? (
              <div className="h-9 w-20 bg-gray-200 dark:bg-slate-700 animate-pulse rounded"></div>
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {totalPatients.toLocaleString()}
              </p>
            )}
          </div>
          <div className="mt-2 h-1 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-sky-500 h-full rounded-full" style={{ width: '78%' }}></div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 p-6 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 shadow-sm">
              <FiCalendar className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="flex items-center text-sky-600 dark:text-sky-400 text-sm font-medium bg-sky-50 dark:bg-sky-900/20 px-2.5 py-1 rounded-full">
              <FiClock className="w-3 h-3 mr-1" />
              Upcoming
            </span>
          </div>
          <h2 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Appointments</h2>
          <div className="flex items-baseline mt-1">
            {isLoadingAppointments ? (
              <div className="h-9 w-20 bg-gray-200 dark:bg-slate-700 animate-pulse rounded"></div>
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {upcomingAppointments.length.toLocaleString() || 0}
              </p>
            )}
          </div>
          <div className="mt-2 h-1 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full" style={{ width: '45%' }}></div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 p-6 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-3 shadow-sm">
              <MdOutlineBiotech className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="flex items-center text-amber-600 dark:text-amber-400 text-sm font-medium bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
              <FiClock className="w-3 h-3 mr-1" />
              {(labMetrics.urgent_pending || 0)} urgent
            </span>
          </div>
          <h2 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Lab Requests</h2>
          <div className="flex items-baseline mt-1">
            {isLoadingLabMetrics ? (
              <div className="h-9 w-20 bg-gray-200 dark:bg-slate-700 animate-pulse rounded"></div>
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {labMetrics.total.toLocaleString()}
              </p>
            )}
          </div>
          <div className="mt-2 h-1 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 h-full rounded-full" style={{ width: '63%' }}></div>
          </div>
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Patients table */}
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden"
          >
            <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 dark:border-slate-700/70">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-0">Active Patients</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {totalPatients} total
                </span>
              </div>
              <div className="flex items-center w-full sm:w-auto mt-3 sm:mt-0">
                <div className="relative mr-2 flex-grow sm:flex-grow-0">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Search patients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-base placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium flex items-center"
                >
                  <FiUsers className="w-4 h-4 mr-2" />
                  <span>View All</span>
                </motion.button>
              </div>
            </div>
            
            {isLoadingPatients ? (
              <div className="p-8 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : errorMessages.patients ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                  <FiAlertCircle className="w-8 h-8" />
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium">{errorMessages.patients}</p>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl transition-colors duration-200 shadow-sm font-medium"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </motion.button>
              </div>
            ) : activePatients.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <FiUsers className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No active patients</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">No patients have been registered yet. When you add patients, they will appear here.</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-6 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium"
                >
                  Add New Patient
                </motion.button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700/70">
                  <thead className="bg-gray-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Patient</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Age</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Gender</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700/70">
                    {activePatients.map((patient) => (
                      <motion.tr 
                        key={patient.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ backgroundColor: "rgba(243, 244, 246, 0.5)", scale: 1.002 }}
                        className="transition-colors dark:hover:bg-slate-700/40"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div 
                              className="flex-shrink-0 h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-800 flex items-center justify-center text-white font-semibold shadow-sm"
                            >
                              {patient.first_name?.[0]}{patient.last_name?.[0]}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {patient.first_name} {patient.last_name}
                              </div>
                              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span className="mr-1">📧</span>
                                {patient.email || "No email provided"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                          {calculateAge(patient.date_of_birth)} <span className="text-xs text-gray-500 dark:text-gray-500">yrs</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {patient.gender || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                              <FiPhone className="h-3.5 w-3.5 mr-1.5 text-indigo-400 dark:text-indigo-500" />
                              {patient.phone_number || "N/A"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                              <FiMapPin className="h-3 w-3 mr-1 text-indigo-400 dark:text-indigo-500" />
                              {patient.address ? (patient.address.length > 20 ? patient.address.substring(0, 20) + '...' : patient.address) : "No address"}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1.5 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusBadgeStyle(patient.status)}`}>
                            {patient.status || "Active"}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="p-5 border-t border-gray-200 dark:border-slate-700/70 flex justify-between items-center">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing <span className="font-medium text-gray-700 dark:text-gray-300">5</span> of <span className="font-medium text-gray-700 dark:text-gray-300">{totalPatients}</span> patients
              </div>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium transition-colors flex items-center"
              >
                View All Patients
                <svg className="ml-1 w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
          
          {/* Lab Analytics with Charts */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            className="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden"
          >
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-slate-700/70">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Lab Analytics</h2>
                <LiveIndicator />
              </div>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium transition-colors flex items-center"
              >
                View Details
              </motion.button>
            </div>
            
            {isLoadingLabMetrics ? (
              <div className="p-8 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : errorMessages.labMetrics ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                  <FiAlertCircle className="w-8 h-8" />
                </div>
                <p className="text-red-600 dark:text-red-400 font-medium">{errorMessages.labMetrics}</p>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl transition-colors duration-200 shadow-sm font-medium"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </motion.button>
              </div>
            ) : (
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Bar Chart - Top Test Types */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700/50">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Requested Tests</h3>
                    <div className="h-64">
                      <Bar 
                        data={barChartData} 
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false,
                            },
                            tooltip: {
                              backgroundColor: 'rgba(17, 24, 39, 0.8)',
                              padding: 12,
                              titleFont: {
                                size: 14,
                              },
                              bodyFont: {
                                size: 13,
                              },
                              boxPadding: 6,
                            },
                          },
                          scales: {
                            x: {
                              grid: {
                                display: false,
                                drawBorder: false,
                              },
                              ticks: {
                                color: document.documentElement.classList.contains('dark') ? 'rgba(209, 213, 219, 0.8)' : 'rgba(55, 65, 81, 0.8)',
                                font: {
                                  size: 11,
                                },
                                maxRotation: 45,
                                minRotation: 45,
                              },
                            },
                            y: {
                              grid: {
                                color: document.documentElement.classList.contains('dark') ? 'rgba(75, 85, 99, 0.16)' : 'rgba(209, 213, 219, 0.4)',
                                drawBorder: false,
                              },
                              ticks: {
                                color: document.documentElement.classList.contains('dark') ? 'rgba(209, 213, 219, 0.8)' : 'rgba(55, 65, 81, 0.8)',
                                font: {
                                  size: 11,
                                },
                                padding: 8,
                              },
                              beginAtZero: true,
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                
                  {/* Donut Chart and Metrics */}
                  <div className="grid grid-cols-1 gap-5">
                    {/* Donut Chart */}
                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700/50">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Request Urgency</h3>
                      <div className="h-40 flex justify-center items-center">
                        <div className="w-40">
                          <Doughnut 
                            data={donutChartData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              cutout: '70%',
                              plugins: {
                                legend: {
                                  position: 'bottom',
                                  labels: {
                                    boxWidth: 12,
                                    padding: 15,
                                    color: document.documentElement.classList.contains('dark') ? 'rgba(209, 213, 219, 0.8)' : 'rgba(55, 65, 81, 0.8)',
                                    font: {
                                      size: 11,
                                    },
                                  },
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(17, 24, 39, 0.8)',
                                  padding: 12,
                                  titleFont: {
                                    size: 14,
                                  },
                                  bodyFont: {
                                    size: 13,
                                  },
                                  boxPadding: 6,
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 flex flex-col justify-between border border-amber-100 dark:border-amber-900/30">
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending</span>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{labMetrics.pending}</span>
                        <span className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                          {Math.round((labMetrics.pending / labMetrics.total) * 100)}% of total
                        </span>
                      </div>
                      
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 flex flex-col justify-between border border-red-100 dark:border-red-900/30">
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">High Urgency</span>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{labMetrics.by_urgency.high}</span>
                        <span className="text-xs text-red-500 dark:text-red-400 mt-1">
                          Requires attention
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-5 border-t border-gray-200 dark:border-slate-700/70 flex justify-end">
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium transition-colors flex items-center"
              >
                View All Lab Requests
                <svg className="ml-1 w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        </div>
        
        {/* Right column - Quick Actions and additional widgets */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 p-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/doctor/ai-diagnosis">
                <motion.div 
                  whileHover={{ y: -5, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl hover:from-indigo-100 hover:to-blue-100 dark:hover:from-indigo-900/30 dark:hover:to-blue-900/30 transition-all duration-200 border border-indigo-100 dark:border-indigo-800/30 group"
                >
                  <div className="mb-3 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl p-3 shadow-md text-white">
                    <RiMentalHealthLine className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Diagnosis</span>
                </motion.div>
              </Link>
              <Link to="/">
                <motion.div 
                  whileHover={{ y: -5, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 transition-all duration-200 border border-emerald-100 dark:border-emerald-800/30 group"
                >
                  <div className="mb-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-3 shadow-md text-white">
                    <MdOutlineBiotech className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Lab Request</span>
                </motion.div>
              </Link>
              <Link to="/">
                <motion.div 
                  whileHover={{ y: -5, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/30 dark:hover:to-purple-900/30 transition-all duration-200 border border-violet-100 dark:border-violet-800/30 group"
                >
                  <div className="mb-3 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl p-3 shadow-md text-white">
                    <HiOutlineDocumentReport className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Create Report</span>
                </motion.div>
              </Link>
              <Link to="/">
                <motion.div 
                  whileHover={{ y: -5, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-col items-center justify-center p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/30 dark:hover:to-orange-900/30 transition-all duration-200 border border-amber-100 dark:border-amber-800/30 group"
                >
                  <div className="mb-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-3 shadow-md text-white">
                    <FiFileText className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">View History</span>
                </motion.div>
              </Link>
            </div>
          </motion.div>
          
          {/* Lab Requests Overview */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 p-6"
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Lab Requests</h2>
              <LiveIndicator />
            </div>
            
            {isLoadingLabMetrics ? (
              <div className="p-4 flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {labRequests.slice(0, 3).map((request) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ y: -2, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" }}
                    className="p-4 rounded-xl border border-gray-100 dark:border-slate-700/50 transition-all duration-200 hover:border-indigo-200 dark:hover:border-indigo-800/50"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2.5 text-indigo-600 dark:text-indigo-400">
                          <MdOutlineBiotech className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">{formatTestTypeName(request.test_type)}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{request.patient_name}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        request.urgency === 'high' 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800/30' 
                          : request.urgency === 'medium' 
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30'
                      }`}>
                        {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        request.status === 'pending' 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30' 
                          : request.status === 'cancelled' 
                            ? 'bg-slate-100 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300 border border-slate-200 dark:border-slate-700/30'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30'
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(request.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-5 w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-medium"
            >
              View All Lab Requests
            </motion.button>
          </motion.div>
          
          {/* Upcoming Appointments Preview Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 p-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Next Appointment</h2>
            
            {isLoadingAppointments ? (
              <div className="p-4 flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
              </div>
            ) : upcomingAppointments.length === 0 ? (
              <div className="text-center py-5">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <FiCalendar className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">No upcoming appointments</p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-800 rounded-xl p-5 text-white shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-11 w-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-lg shadow-inner">
                      {getInitials(upcomingAppointments[0].patient_name)}
                    </div>
                    <div>
                      <p className="font-medium">{upcomingAppointments[0].patient_name}</p>
                      <p className="text-xs text-indigo-100 mt-0.5">{upcomingAppointments[0].appointment_type || "Consultation"}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/20 backdrop-blur-sm">
                    {formatAppointmentTime(upcomingAppointments[0].appointment_datetime).date}
                  </span>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <FiClock className="w-4 h-4" />
                  <span className="text-sm font-medium">{formatAppointmentTime(upcomingAppointments[0].appointment_datetime).time}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-all duration-200"
                >
                  View Details
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
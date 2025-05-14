import React, { useState, useEffect } from 'react';
import { FiUsers, FiCalendar, FiClock, FiClipboard, FiPlus, FiSearch, 
  FiFileText, FiUserPlus, FiRefreshCw, FiArrowRight, FiBell, FiSliders } from 'react-icons/fi';
import axios from 'axios';

// Assuming you'll add these libraries to your project
// import { motion, AnimatePresence } from 'framer-motion';
// import { Toaster, toast } from 'react-hot-toast';

function CardRoomDashboard() {
  // State management - keeping existing logic
  const [stats, setStats] = useState({
    patientsToday: 0,
    totalPatientsRegistered: 0,
    totalAppointmentsScheduled: 0,
    totalOPDAssignments: 0
  });
  const [activePatients, setActivePatients] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState({
    stats: true,
    recentPatients: true,
    appointments: true
  });
  
  // Error states
  const [error, setError] = useState({
    stats: null,
    recentPatients: null,
    appointments: null
  });

  // Keeping all existing fetch functions unchanged
  const fetchStats = async () => {
    try {
      setLoading(prev => ({ ...prev, stats: true }));
      
      const today = new Date().toISOString().split('T')[0];
      
      const patientsToday = await axios.get('http://localhost:8023/api/patients', {
        params: {
          from_date: `${today}T00:00:00`,
          to_date: `${today}T23:59:59`,
          page: 1,
          page_size: 1
        }
      });
      
      const totalPatients = await axios.get('http://localhost:8023/api/patients', {
        params: {
          page: 1,
          page_size: 1
        }
      });
      
      const appointments = await axios.get('http://localhost:8023/api/appointments', {
        params: {
          page: 1,
          page_size: 1
        }
      });
      
      const opdAssignments = await axios.get('http://localhost:8023/api/opd-assignments', {
        params: {
          page: 1,
          page_size: 1
        }
      });
      
      setStats({
        patientsToday: patientsToday.data.total || 0,
        totalPatientsRegistered: totalPatients.data.total || 0,
        totalAppointmentsScheduled: appointments.data.total || 0,
        totalOPDAssignments: opdAssignments.data.total || 0
      });
      
      setError(prev => ({ ...prev, stats: null }));
      // If using toast notifications, uncomment:
      // toast.success('Statistics updated successfully');
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(prev => ({ ...prev, stats: err.message }));
      // If using toast notifications, uncomment:
      // toast.error('Failed to update statistics');
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  };

  const fetchRecentPatients = async () => {
    try {
      setLoading(prev => ({ ...prev, recentPatients: true }));
      
      const response = await axios.get('http://localhost:8023/api/patients', {
        params: {
          page: 1,
          page_size: 10,
          sort: '-created_at'
        }
      });
      
      const patients = response.data.data.map(patient => ({
        id: patient.id,
        name: `${patient.first_name} ${patient.last_name}`,
        age: calculateAge(patient.date_of_birth),
        gender: patient.gender,
        contact: patient.phone_number,
        registrationDate: new Date(patient.created_at).toLocaleDateString()
      }));
      
      setRecentPatients(patients);
      setError(prev => ({ ...prev, recentPatients: null }));
    } catch (err) {
      console.error('Error fetching recent patients:', err);
      setError(prev => ({ ...prev, recentPatients: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, recentPatients: false }));
    }
  };

  const fetchAppointmentsAndActive = async () => {
    try {
      setLoading(prev => ({ ...prev, appointments: true }));
      
      const today = new Date().toISOString().split('T')[0];
      
      const response = await axios.get('http://localhost:8023/api/appointments', {
        params: {
          from_date: `${today}T00:00:00`,
          to_date: `${today}T23:59:59`,
          page: 1,
          page_size: 20,
          sort: 'appointment_date'
        }
      });
      
      const appointments = response.data.data.map(appointment => ({
        id: appointment.id,
        patientId: appointment.patient_id,
        patientName: appointment.patient_name,
        time: new Date(appointment.appointment_date).toLocaleTimeString([], 
          { hour: '2-digit', minute: '2-digit' }),
        date: new Date(appointment.appointment_date).toLocaleDateString(),
        department: appointment.department,
        status: appointment.status
      }));
      
      const activePatients = appointments
        .filter(apt => apt.status === 'in_progress' || apt.status === 'waiting')
        .map(apt => ({
          id: apt.patientId,
          name: apt.patientName,
          age: '',
          status: apt.status === 'in_progress' ? 'With doctor' : 'Waiting for doctor',
          doctor: '',
          registeredTime: apt.time,
          department: apt.department
        }));
      
      const upcomingAppts = appointments
        .filter(apt => apt.status === 'scheduled')
        .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
      
      setActivePatients(activePatients);
      setUpcomingAppointments(upcomingAppts);
      setError(prev => ({ ...prev, appointments: null }));
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(prev => ({ ...prev, appointments: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, appointments: false }));
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const ageDate = new Date(difference);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  useEffect(() => {
    fetchStats();
    fetchRecentPatients();
    fetchAppointmentsAndActive();
    
    const refreshInterval = setInterval(() => {
      fetchStats();
      fetchRecentPatients();
      fetchAppointmentsAndActive();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  const handleRegisterPatient = () => {
    window.location.href = '/patients/register';
  };

  const handleScheduleAppointment = () => {
    window.location.href = '/appointments/create';
  };

  const handleCreateOPDAssignment = () => {
    window.location.href = '/opd-assignments/create';
  };

  const handleFindPatient = () => {
    window.location.href = '/patients/search';
  };

  const handleRefresh = () => {
    // If using toast notifications, uncomment:
    // toast.loading('Refreshing dashboard...');
    
    fetchStats();
    fetchRecentPatients();
    fetchAppointmentsAndActive();
  };

  return (
    <div className="p-4 md:p-6 max-w-8xl mx-auto font-sans">
      {/* Uncomment if using toast notifications 
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
            borderRadius: '0.5rem',
          },
        }}
      /> */}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500 dark:from-blue-400 dark:to-teal-300">
            Card Room Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Welcome back, Mr. 
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            aria-label="Notifications"
            className="p-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-full shadow-sm hover:shadow transition-all duration-200 border border-gray-100 dark:border-gray-700 flex items-center justify-center"
          >
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            <FiBell className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleRefresh}
            aria-label="Refresh dashboard"
            className="flex items-center gap-2 px-4 py-2.5 font-medium bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:translate-y-[-1px]"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading.stats || loading.recentPatients || loading.appointments ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-1 shadow-xl shadow-blue-900/5 dark:shadow-blue-500/5">
          <div className="relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Patients Today</p>
                {loading.stats ? (
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded my-1"></div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.patientsToday}</p>
                )}
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <span className="mr-1">↑ 12%</span>
                  <span>vs yesterday</span>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-full h-12 w-12 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <FiUsers className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-1 shadow-xl shadow-purple-900/5 dark:shadow-purple-500/5">
          <div className="relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Patients</p>
                {loading.stats ? (
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded my-1"></div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalPatientsRegistered}</p>
                )}
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <span className="mr-1">↑ 3%</span>
                  <span>this month</span>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-full h-12 w-12 bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                <FiUsers className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-1 shadow-xl shadow-green-900/5 dark:shadow-green-500/5">
          <div className="relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Appointments</p>
                {loading.stats ? (
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded my-1"></div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalAppointmentsScheduled}</p>
                )}
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <span className="mr-1">↑ 5%</span>
                  <span>this week</span>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-full h-12 w-12 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                <FiCalendar className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 p-1 shadow-xl shadow-amber-900/5 dark:shadow-amber-500/5">
          <div className="relative rounded-xl overflow-hidden bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">OPD Assignments</p>
                {loading.stats ? (
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded my-1"></div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalOPDAssignments}</p>
                )}
                <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center mt-1">
                  <span className="mr-1">→ 0%</span>
                  <span>no change</span>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-full h-12 w-12 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <FiClipboard className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="relative rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-6 shadow-lg mb-8 backdrop-blur-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quick Access</h2>
          <button className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center hover:underline">
            Customize
            <FiSliders className="ml-1.5 w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <button 
            onClick={handleRegisterPatient}
            className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 p-5 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col items-center hover:translate-y-[-2px] border border-gray-100 dark:border-gray-700"
            aria-label="Register Patient"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-blue-600/5 dark:from-blue-500/10 dark:to-blue-600/10 transform group-hover:opacity-100 opacity-0 transition-opacity"></div>
            <div className="relative flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white dark:group-hover:bg-blue-600 transition-colors duration-300">
              <FiUserPlus className="w-7 h-7" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Register Patient</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">New enrollment</span>
          </button>
          
          <button 
            onClick={handleScheduleAppointment}
            className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 p-5 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col items-center hover:translate-y-[-2px] border border-gray-100 dark:border-gray-700"
            aria-label="Schedule Appointment"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-teal-600/5 dark:from-teal-500/10 dark:to-teal-600/10 transform group-hover:opacity-100 opacity-0 transition-opacity"></div>
            <div className="relative flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white dark:group-hover:bg-teal-600 transition-colors duration-300">
              <FiCalendar className="w-7 h-7" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Schedule Appointment</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Book a visit</span>
          </button>
          
          <button 
            onClick={handleCreateOPDAssignment}
            className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 p-5 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col items-center hover:translate-y-[-2px] border border-gray-100 dark:border-gray-700"
            aria-label="Create OPD Assignment"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-amber-600/5 dark:from-amber-500/10 dark:to-amber-600/10 transform group-hover:opacity-100 opacity-0 transition-opacity"></div>
            <div className="relative flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white dark:group-hover:bg-amber-600 transition-colors duration-300">
              <FiPlus className="w-7 h-7" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Create OPD Assignment</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Outpatient dept.</span>
          </button>
          
          <button 
            onClick={handleFindPatient}
            className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 p-5 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col items-center hover:translate-y-[-2px] border border-gray-100 dark:border-gray-700"
            aria-label="Find Patient"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-purple-600/5 dark:from-purple-500/10 dark:to-purple-600/10 transform group-hover:opacity-100 opacity-0 transition-opacity"></div>
            <div className="relative flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white dark:group-hover:bg-purple-600 transition-colors duration-300">
              <FiSearch className="w-7 h-7" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Find Patient</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Search records</span>
          </button>
        </div>
      </div>
      
      {/* Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="relative rounded-2xl bg-white dark:bg-gray-800 shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recently Registered</h2>
            <button className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center hover:underline">
              View all
              <FiArrowRight className="ml-1.5 w-4 h-4" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {loading.recentPatients ? (
              <div className="p-6">
                <div className="animate-pulse space-y-5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : error.recentPatients ? (
              <div className="flex p-6 items-center justify-center">
                <div className="text-center py-6 px-10 bg-red-50 dark:bg-red-900/10 rounded-lg max-w-md">
                  <div className="text-red-500 text-xl mb-2">Unable to load patients</div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{error.recentPatients}</p>
                  <button 
                    onClick={fetchRecentPatients}
                    className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : recentPatients.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentPatients.slice(0, 5).map((patient) => (
                  <div key={patient.id} className="group p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-150 flex items-center">
                    <div className="flex-shrink-0 mr-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
                        {patient.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    
                    <div className="flex-grow">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{patient.name}</h3>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Registered {patient.registrationDate}
                        </div>
                      </div>
                      
                      <div className="mt-1 flex items-center text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mr-2">
                          {patient.age} years
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mr-2">
                          {patient.gender}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">{patient.contact}</span>
                      </div>
                    </div>
                    
                    <div className="ml-2 flex-shrink-0 flex space-x-1">
                      <button 
                        onClick={() => window.location.href = `/patients/${patient.id}`}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        aria-label="View patient details"
                      >
                        <FiFileText className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => window.location.href = `/appointments/create?patient_id=${patient.id}`}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                        aria-label="Schedule appointment"
                      >
                        <FiCalendar className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-2">No recent registrations</p>
                  <button 
                    onClick={handleRegisterPatient}
                    className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
                  >
                    Register New Patient
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default CardRoomDashboard;
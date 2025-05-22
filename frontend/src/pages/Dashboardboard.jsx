import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FiMenu, FiBell, FiHome, FiActivity, FiClipboard, 
  FiFileText, FiLayers, FiCalendar, FiSearch, FiUsers, FiSettings, 
  FiChevronRight, FiChevronDown, FiChevronsLeft, FiUser, FiCheck, FiX, FiInfo, FiSlack, FiBarChart2, FiLock, FiEye, FiEyeOff} from 'react-icons/fi';
import { HiOutlineUserAdd, HiOutlineDocumentReport, HiOutlineChartBar, HiOutlineClock } from 'react-icons/hi';
import { MdOutlineBiotech, MdOutlineHealthAndSafety, MdDashboard, MdOutlineNightlight, MdOutlineLightMode, MdTimeline } from 'react-icons/md';
import { RiMentalHealthLine, RiPulseLine, RiStethoscopeLine, RiHealthBookLine, RiLogoutCircleRLine, RiShieldUserLine } from 'react-icons/ri';
import { TbReportMedical, TbHeartRateMonitor, TbVirus } from 'react-icons/tb';
import { LuLogOut } from 'react-icons/lu';

// Import all dashboard components
import DoctorDashboard from './Doctor/DoctorDashboard';
import DoctorAppointments from './Doctor/Appointments';
import DoctorAIDiagnosis from './Doctor/AiDiagnosis';
import LabRequestsDashboard from './Doctor/LabRequests';
import DoctorMedicalReports from './Doctor/MedicalReports';
import DoctorPatients from './Doctor/PatientManagement';
import PatientStatus from './Doctor/PatientStatus';
import CardRoomDashboard from './CardRoom/CardRoomDashboard';
import RegisterPatient from './CardRoom/PatientRegistration';
import PatientRecords from './CardRoom/PatientRecords';
import CardRoomAppointments from './CardRoom/Appointments';
import OPDAssignment from './CardRoom/OPDAssignment';
import AdminDashboard from './Admin/AdminDashboard';
import UserManagement from './Admin/UserManagement';
import Analytics from './Admin/Analytics';
import LabDashboard from './Doctor/LabTech/LabTechDashboard';
import LabRequestsList from './Doctor/LabTech/TestRequests';
import TestResults from './Doctor/LabTech/TestResults';
import LabPatients from './Doctor/LabTech/LabPatients';
import LabHistory from './Doctor/LabTech/LabHistory';
import LabReports from './Doctor/LabTech/LabReports';
import LabTests from './Doctor/LabTests';

// Import high-quality fonts
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,301,701,300,501,401,901,400&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
`;

// Default avatar URL (placeholder)
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='50' height='50'%3E%3Cpath fill='none' d='M0 0h24v24H0z'/%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-4.987-3.744A7.966 7.966 0 0 0 12 20c1.97 0 3.773-.712 5.167-1.892A6.979 6.979 0 0 0 12.16 16a6.981 6.981 0 0 0-5.147 2.256zM5.616 16.82A8.975 8.975 0 0 1 12.16 14a8.972 8.972 0 0 1 6.362 2.634 8 8 0 1 0-12.906.187zM12 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' fill='rgba(148,163,184,1)'/%3E%3C/svg%3E";

// Enhanced Toast Notification System
const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[10] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`p-4 rounded-2xl shadow-lg backdrop-blur-md flex items-start gap-3 max-w-sm pointer-events-auto ${
              toast.type === 'success' ? 'bg-emerald-100/90 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200/50 dark:border-emerald-800/30' :
              toast.type === 'error' ? 'bg-rose-100/90 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 border border-rose-200/50 dark:border-rose-800/30' :
              toast.type === 'warning' ? 'bg-amber-100/90 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border border-amber-200/50 dark:border-amber-800/30' :
              'bg-sky-100/90 dark:bg-sky-900/80 text-sky-800 dark:text-sky-200 border border-sky-200/50 dark:border-sky-800/30'
            }`}
          >
            <div className="flex-shrink-0 pt-0.5">
              {toast.type === 'success' && <FiCheck className="w-5 h-5" />}
              {toast.type === 'error' && <FiX className="w-5 h-5" />}
              {toast.type === 'warning' && <FiInfo className="w-5 h-5" />}
              {toast.type === 'info' && <FiInfo className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <h4 className="text-sm font-semibold font-satoshi">{toast.title}</h4>
                <button 
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs mt-1 font-inter">{toast.message}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Enhanced notification component with glass effect and micro-animations
const Notification = ({ notification, onClick }) => {
  const getIconByType = () => {
    switch(notification.type) {
      case 'appointment':
        return <FiCalendar className="w-5 h-5 text-violet-500" />;
      case 'lab':
        return <MdOutlineBiotech className="w-5 h-5 text-teal-500" />;
      case 'patient':
        return <FiUser className="w-5 h-5 text-sky-500" />;
      case 'alert':
        return <FiInfo className="w-5 h-5 text-amber-500" />;
      default:
        return <FiBell className="w-5 h-5 text-slate-500" />;
    }
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.02, x: 3 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/60 hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-slate-50/30 dark:hover:from-slate-800/40 dark:hover:to-slate-800/10 flex gap-3 cursor-pointer transition-all duration-200 ${
        !notification.read ? 'bg-gradient-to-r from-sky-50/70 to-indigo-50/50 dark:from-sky-900/20 dark:to-indigo-900/10' : ''
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-slate-100/90 to-slate-50/80 dark:from-slate-800/90 dark:to-slate-700/80 shadow-inner backdrop-blur-sm">
          {getIconByType()}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <p className="font-medium text-slate-800 dark:text-slate-200 font-satoshi">{notification.title}</p>
          {!notification.read && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 pulse-subtle"></span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 font-inter">{notification.message}</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 font-inter">{notification.time}</p>
      </div>
    </motion.div>
  );
};

// Enhanced tooltip component with glass morphism
const Tooltip = ({ children, text, position = 'right', delay = 300, className = "" }) => {
  const [show, setShow] = useState(false);
  const timer = useRef(null);
  
  const positions = {
    right: "left-full ml-2",
    left: "right-full mr-2",
    top: "bottom-full mb-2",
    bottom: "top-full mt-2"
  };
  
  const handleMouseEnter = () => {
    timer.current = setTimeout(() => setShow(true), delay);
  };
  
  const handleMouseLeave = () => {
    clearTimeout(timer.current);
    setShow(false);
  };
  
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  
  return (
    <div 
      className={`relative flex items-center ${className}`} 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[10] whitespace-nowrap ${positions[position]} px-3 py-1.5 text-xs font-medium text-white bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-lg`}
          >
            {text}
            <div className={`absolute w-1.5 h-1.5 bg-slate-800/95 transform rotate-45 ${
              position === 'right' ? 'left-0 -translate-x-1/2 top-1/2 -translate-y-1/2' : 
              position === 'left' ? 'right-0 translate-x-1/2 top-1/2 -translate-y-1/2' : 
              position === 'top' ? 'bottom-0 translate-y-1/2 left-1/2 -translate-x-1/2' : 
              'top-0 -translate-y-1/2 left-1/2 -translate-x-1/2'
            }`}></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Enhanced NavItem component with improved tooltips
const NavItem = ({ icon, text, path, isActive, onClick, collapsed }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.li 
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {collapsed ? (
        <div className="relative">
          <Link
            to={path}
            onClick={onClick}
            className={`flex items-center justify-center px-3 py-3.5 rounded-2xl transition-all duration-200 ${
              isActive 
                ? 'bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/60 dark:to-indigo-950/60 shadow-[0_2px_10px_rgba(56,189,248,0.15)] dark:shadow-[0_2px_8px_rgba(56,189,248,0.07)] text-sky-700 dark:text-sky-300' 
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent dark:text-slate-300 dark:hover:bg-gradient-to-r dark:hover:from-slate-800/60 dark:hover:to-transparent'
            }`}
            aria-label={text}
          >
            <div className={`${
              isActive 
                ? 'text-sky-500 dark:text-sky-400' 
                : 'text-slate-500 dark:text-slate-400'
            }`}>
              {icon}
            </div>
            {isActive && (
              <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 shadow-sm"></div>
            )}
          </Link>
          
          {/* Expanded label on hover */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute left-full top-0 ml-2 rounded-xl bg-white dark:bg-slate-800 shadow-lg z-10 whitespace-nowrap"
              >
                <div className={`px-4 py-3 rounded-xl flex items-center ${
                  isActive 
                    ? 'bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/60 dark:to-indigo-950/60 text-sky-700 dark:text-sky-300' 
                    : 'text-slate-700 dark:text-slate-300'
                }`}>
                  <span className="text-sm font-medium font-satoshi">{text}</span>
                </div>
                <div className="absolute right-full top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white dark:bg-slate-800 transform rotate-45 shadow-lg"></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <Link
          to={path}
          onClick={onClick}
          className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 ${
            isActive 
              ? 'bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/60 dark:to-indigo-950/60 shadow-[0_2px_10px_rgba(56,189,248,0.15)] dark:shadow-[0_2px_8px_rgba(56,189,248,0.07)] text-sky-700 dark:text-sky-300' 
              : 'text-slate-600 hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent dark:text-slate-300 dark:hover:bg-gradient-to-r dark:hover:from-slate-800/60 dark:hover:to-transparent'
          }`}
        >
          <div className="flex items-center">
            <div className={`${
              isActive 
                ? 'text-sky-500 dark:text-sky-400' 
                : 'text-slate-500 dark:text-slate-400'
            } mr-3`}>
              {icon}
            </div>
            <span className={`text-sm font-medium transition-all duration-200 font-satoshi ${
              isActive 
                ? 'text-sky-700 dark:text-sky-300' 
                : 'text-slate-700 dark:text-slate-300'
            }`}>{text}</span>
          </div>
          {isActive && (
            <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 shadow-sm"></div>
          )}
        </Link>
      )}
    </motion.li>
  );
};

// Global loader component for smooth UI experience
const LoadingSpinner = ({ className = "", size = "md" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12"
  };
  
  return (
    <div className={`${className} flex justify-center items-center`}>
      <div className={`${sizeClasses[size]} rounded-full relative`}>
        <div className="absolute w-full h-full border-2 border-slate-200 dark:border-slate-700 rounded-full"></div>
        <div className="absolute w-full h-full border-2 border-t-sky-500 dark:border-t-sky-500 rounded-full animate-spin"></div>
      </div>
    </div>
  );
};

// Enhanced avatar component with circular role indicator
const UserAvatar = ({ src, alt, size = "md", status = null, roleColor = null, roleIcon = null, className = "" }) => {
  const sizes = {
    xs: "w-8 h-8",
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };
  
  const statusSizes = {
    xs: "w-2 h-2",
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4",
    xl: "w-5 h-5",
  };
  
  const iconSizes = {
    xs: "w-3 h-3",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
    xl: "w-7 h-7",
  };
  
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizes[size]} rounded-full bg-gradient-to-tl from-indigo-200 via-sky-100 to-indigo-100 dark:from-indigo-800/40 dark:via-sky-900/40 dark:to-indigo-900/40 p-0.5 shadow-lg`}>
        <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden">
          {src ? (
            <img 
              src={src} 
              alt={alt || "User"} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <img 
              src={DEFAULT_AVATAR} 
              alt={alt || "User"} 
              className="w-full h-full object-cover" 
            />
          )}
        </div>
      </div>
      
      {status && (
        <div className={`absolute bottom-0 right-0 ${statusSizes[size]} rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800`}></div>
      )}
      
      {roleIcon && roleColor && (
        <div className={`absolute -bottom-1 -right-1 ${statusSizes[size]} rounded-full ${roleColor} flex items-center justify-center text-white shadow-lg z-0`}>
          {roleIcon}
        </div>
      )}
    </div>
  );
};

// Animated page transition wrapper
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3 }}
    className="w-full"
  >
    {children}
  </motion.div>
);

// Modal component for various dialogs
const Modal = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef(null);
  
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling on body when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
      // Restore scrolling on body when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          ref={modalRef}
          className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-soft-lg border border-slate-200/50 dark:border-slate-700/30 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white font-satoshi">{title}</h3>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// Password Change Form Component
const ChangePasswordForm = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing again
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit({
        current_password: formData.currentPassword,
        new_password: formData.newPassword
      });
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <div className="mb-5">
          <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 font-satoshi">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              className={`w-full px-4 py-3 rounded-xl bg-slate-100/70 dark:bg-slate-700/40 border ${
                errors.currentPassword 
                ? 'border-rose-500 dark:border-rose-500' 
                : 'border-slate-200/70 dark:border-slate-700/70'
              } focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 dark:focus:border-sky-500 
              focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-sky-500/20 focus:outline-none 
              text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500
              transition-all duration-200 font-inter text-base`}
              placeholder="Your current password"
            />
            <button 
              type="button" 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
            </button>
          </div>
          {errors.currentPassword && (
            <p className="mt-1.5 text-rose-500 text-sm font-inter">{errors.currentPassword}</p>
          )}
        </div>
        
        <div className="mb-5">
          <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 font-satoshi">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className={`w-full px-4 py-3 rounded-xl bg-slate-100/70 dark:bg-slate-700/40 border ${
                errors.newPassword 
                ? 'border-rose-500 dark:border-rose-500' 
                : 'border-slate-200/70 dark:border-slate-700/70'
              } focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 dark:focus:border-sky-500 
              focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-sky-500/20 focus:outline-none 
              text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500
              transition-all duration-200 font-inter text-base`}
              placeholder="Enter new password"
            />
            <button 
              type="button" 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
            </button>
          </div>
          {errors.newPassword && (
            <p className="mt-1.5 text-rose-500 text-sm font-inter">{errors.newPassword}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 font-satoshi">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full px-4 py-3 rounded-xl bg-slate-100/70 dark:bg-slate-700/40 border ${
                errors.confirmPassword 
                ? 'border-rose-500 dark:border-rose-500' 
                : 'border-slate-200/70 dark:border-slate-700/70'
              } focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 dark:focus:border-sky-500 
              focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-sky-500/20 focus:outline-none 
              text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500
              transition-all duration-200 font-inter text-base`}
              placeholder="Confirm new password"
            />
            <button 
              type="button" 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1.5 text-rose-500 text-sm font-inter">{errors.confirmPassword}</p>
          )}
        </div>
      </div>
      
      <div className="flex justify-end mt-6 space-x-3">
        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 focus:ring-2 focus:ring-sky-500/30 focus:outline-none font-satoshi flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Updating...
            </>
          ) : (
            'Update Password'
          )}
        </button>
      </div>
    </form>
  );
};

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const shouldReduceMotion = useReducedMotion();
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New patient assigned', message: 'John Doe has been assigned to your care. Review medical history before the appointment.', time: '5 min ago', read: false, type: 'patient' },
    { id: 2, title: 'Lab results ready', message: 'CBC and metabolic panel results for Sarah Smith are now available for review.', time: '10 min ago', read: false, type: 'lab' },
    { id: 3, title: 'Upcoming appointment', message: 'You have a follow-up scheduled with Michael Johnson at 2:30 PM today.', time: '1 hour ago', read: true, type: 'appointment' },
    { id: 4, title: 'System maintenance', message: 'Scheduled system update tonight at 2:00 AM. Service may be unavailable for 30 minutes.', time: '3 hours ago', read: true, type: 'alert' },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileDropdownRef = useRef(null);
  
  // Change Password State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Sample data for dashboard components
  const [activePatients] = useState([
    { id: 'P10021', name: 'John Doe', age: 42, status: 'Waiting for doctor' },
    { id: 'P10022', name: 'Sarah Smith', age: 35, status: 'Lab test in progress' },
  ]);

  const [stats] = useState({
    patientsToday: 24,
    pendingAppointments: 12,
    completedAppointments: 18,
  });

  // Track window width for responsive design
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check screen width for responsive sidebar
  const checkScreenWidth = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  };

  // Add toast notification
  const addToast = (title, message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };
  
  // Remove toast notification
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    // Initial screen width check
    checkScreenWidth();
    
    // Update document class for dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Listen for system color scheme changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleDarkModeChange = (e) => setIsDarkMode(e.matches);
    
    // Listen for window resize events
    window.addEventListener('resize', checkScreenWidth);
    
    if (darkModeMediaQuery.addEventListener) {
      darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
      return () => {
        darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
        window.removeEventListener('resize', checkScreenWidth);
      };
    } else {
      // For older browsers
      darkModeMediaQuery.addListener(handleDarkModeChange);
      return () => {
        darkModeMediaQuery.removeListener(handleDarkModeChange);
        window.removeEventListener('resize', checkScreenWidth);
      };
    }
  }, [isDarkMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close profile dropdown when clicking outside
      if (showProfileDropdown && profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
      
      // Close notifications when clicking outside
      if (showNotifications && notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown, showNotifications]);

  // Toast notification demo (for testing)
  useEffect(() => {
    // Welcome toast notification
    setTimeout(() => {
      addToast(
        'Welcome back!', 
        `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.full_name || 'User'}.`, 
        'success'
      );
    }, 1000);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    addToast(
      isDarkMode ? 'Light mode activated' : 'Dark mode activated', 
      isDarkMode ? 'Switched to light theme.' : 'Switched to dark theme.', 
      'info'
    );
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (showProfileDropdown) setShowProfileDropdown(false);
  };

  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
    if (showNotifications) setShowNotifications(false);
  };

  const toggleMobileSearch = () => {
    setIsMobileSearchOpen(!isMobileSearchOpen);
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(notif => ({ ...notif, read: true })));
    addToast('Notifications cleared', 'All notifications marked as read.', 'success');
  };

  const markAsRead = (id) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  const getUnreadCount = () => {
    return notifications.filter(notif => !notif.read).length;
  };

  const getSidebarItems = () => {
    switch(user?.role) {
      case 'doctor':
        return [
          { icon: <MdDashboard className="w-5 h-5" />, text: 'Dashboard', path: '/dashboard/doctor' },
          { icon: <FiUsers className="w-5 h-5" />, text: 'My Patients', path: '/dashboard/doctor/patients' },
          { icon: <FiCalendar className="w-5 h-5" />, text: 'Appointments', path: '/dashboard/doctor/appointments' },
          { icon: <MdTimeline className="w-5 h-5" />, text: 'My Patient Status', path: '/dashboard/doctor/patient-status' },
          { icon: <RiMentalHealthLine className="w-5 h-5" />, text: 'AI Diagnosis', path: '/dashboard/doctor/ai-diagnosis' },
          { icon: <MdOutlineBiotech className="w-5 h-5" />, text: 'Lab Requests', path: '/dashboard/doctor/lab-requests' },
          { icon: <TbReportMedical className="w-5 h-5" />, text: 'Lab Results', path: '/dashboard/doctor/lab-tests' },
          { icon: <HiOutlineDocumentReport className="w-5 h-5" />, text: 'Medical Reports', path: '/dashboard/doctor/medical-reports' },
        ];
      case 'cardroom':
        return [
          { icon: <MdDashboard className="w-5 h-5" />, text: 'Dashboard', path: '/dashboard/cardroom' },
          { icon: <HiOutlineUserAdd className="w-5 h-5" />, text: 'Register Patient', path: '/dashboard/cardroom/register-patient' },
          { icon: <FiUsers className="w-5 h-5" />, text: 'Patient Records', path: '/dashboard/cardroom/patient-records' },
          { icon: <FiLayers className="w-5 h-5" />, text: 'OPD Assignment', path: '/dashboard/cardroom/opd-assignment' },
          { icon: <FiCalendar className="w-5 h-5" />, text: 'Appointments', path: '/dashboard/cardroom/appointments' },         
        ];
      case 'labroom':
        return [
          { icon: <MdDashboard className="w-5 h-5" />, text: 'Dashboard', path: '/dashboard/labroom' },
          { icon: <RiHealthBookLine className="w-5 h-5" />, text: 'Lab Requests', path: '/dashboard/labroom/requests' },
          { icon: <TbHeartRateMonitor className="w-5 h-5" />, text: 'Test Results', path: '/dashboard/labroom/results' },
          { icon: <HiOutlineChartBar className="w-5 h-5" />, text: 'Lab Reports', path: '/dashboard/labroom/reports' },
          { icon: <HiOutlineClock className="w-5 h-5" />, text: 'Lab History', path: '/dashboard/labroom/history' },
        ];
      case 'admin':
        return [
          { icon: <MdDashboard className="w-5 h-5" />, text: 'Dashboard', path: '/dashboard/admin' },
          { icon: <FiUsers className="w-5 h-5" />, text: 'User Management', path: '/dashboard/admin/users' },
          { icon: <FiBarChart2 className="w-5 h-5" />, text: "User Insights", path: "/dashboard/admin/analytics" },
        ];
      default:
        return [];
    }
  };

  const getRoleName = () => {
    switch(user?.role) {
      case 'doctor': return 'Physician';
      case 'cardroom': return 'Card Room Officer';
      case 'labroom': return 'Laboratory Technician';
      case 'admin': return 'System Administrator';
      default: return 'User';
    }
  };

  const getRoleColor = () => {
    switch(user?.role) {
      case 'doctor': return 'bg-teal-500';
      case 'cardroom': return 'bg-amber-500';
      case 'labroom': return 'bg-purple-500';
      case 'admin': return 'bg-rose-500';
      default: return 'bg-blue-500';
    }
  };

  const getRoleIcon = () => {
    switch(user?.role) {
      case 'doctor': return <RiStethoscopeLine className="w-4 h-4" />;
      case 'cardroom': return <FiFileText className="w-4 h-4" />;
      case 'labroom': return <MdOutlineBiotech className="w-4 h-4" />;
      case 'admin': return <FiSettings className="w-4 h-4" />;
      default: return <FiUser className="w-4 h-4" />;
    }
  };

  const getPageTitle = () => {
    const path = location.pathname;
    const activeItem = getSidebarItems().find(item => item.path === path);
    return activeItem ? activeItem.text : 'Dashboard';
  };

  const sharedProps = {
    activePatients,
    stats,
    userRole: user?.role,
    addToast
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
  };
  
  // Function to handle change password
  const handleChangePassword = async (passwordData) => {
    setIsChangingPassword(true);
    
    try {
      // Get the token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await fetch('http://localhost:8022/users/me/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Include the token in the authorization header
        },
        body: JSON.stringify(passwordData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to change password');
      }
      
      // Show success message and close modal
      addToast('Password Updated', 'Your password has been changed successfully.', 'success');
      setShowChangePasswordModal(false);
    } catch (error) {
      addToast('Password Update Failed', error.message, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className={`font-[Inter,Satoshi,Poppins,system-ui,sans-serif] flex h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 transition-colors duration-300 text-slate-800 dark:text-slate-200 ${isDarkMode ? 'dark' : ''}`}>
      <style>{fontStyle}</style>
      
      {/* CSS for custom scrollbar, animations and other styles */}
      <style>
        {`
          /* Font variables for fluid typography */
          :root {
            --font-size-xs: clamp(0.75rem, 0.7vw, 0.875rem);
            --font-size-sm: clamp(0.875rem, 0.8vw, 1rem);
            --font-size-base: clamp(1rem, 0.9vw, 1.125rem);
            --font-size-lg: clamp(1.125rem, 1.1vw, 1.25rem);
            --font-size-xl: clamp(1.25rem, 1.3vw, 1.5rem);
            --font-size-2xl: clamp(1.5rem, 1.5vw, 1.875rem);
            --font-size-3xl: clamp(1.875rem, 2vw, 2.25rem);
            --font-size-4xl: clamp(2.25rem, 2.5vw, 3rem);
          }
          
          /* Font assignments */
          .font-inter {
            font-family: 'Inter', sans-serif;
          }
          
          .font-satoshi {
            font-family: 'Satoshi', sans-serif;
          }
          
          .font-poppins {
            font-family: 'Poppins', sans-serif;
          }
          
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
          
          /* For Firefox */
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05);
          }
          
          .dark * {
            scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
          }
          
          /* Line clamp utility */
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          
          /* Subtle glass effect */
          .glass-effect {
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }
          
          .dark .glass-effect {
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
          }
          
          /* Glow effects */
          .glow {
            box-shadow: 0 0 15px rgba(93, 92, 222, 0.1);
          }
          
          .dark .glow {
            box-shadow: 0 0 15px rgba(93, 92, 222, 0.15);
          }
          
          /* Animated background gradient */
          @keyframes gradientFlow {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          
          .animated-gradient {
            background: linear-gradient(-45deg, rgba(56, 189, 248, 0.06), rgba(93, 92, 222, 0.06), rgba(16, 185, 129, 0.06));
            background-size: 200% 200%;
            animation: gradientFlow 20s ease infinite;
          }
          
          .dark .animated-gradient {
            background: linear-gradient(-45deg, rgba(56, 189, 248, 0.04), rgba(93, 92, 222, 0.04), rgba(16, 185, 129, 0.04));
            background-size: 200% 200%;
            animation: gradientFlow 20s ease infinite;
          }

          /* Premium gradient backgrounds */
          .premium-gradient-blue {
            background: linear-gradient(135deg, #38bdf8, #6366f1);
          }
          
          .premium-gradient-teal {
            background: linear-gradient(135deg, #0ea5e9, #10b981);
          }
          
          .premium-gradient-purple {
            background: linear-gradient(135deg, #8b5cf6, #d946ef);
          }
          
          .premium-gradient-amber {
            background: linear-gradient(135deg, #f59e0b, #ef4444);
          }
          
          /* Soft shadow utilities */
          .shadow-soft {
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04), 0 4px 15px rgba(0, 0, 0, 0.03);
          }
          
          .dark .shadow-soft {
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 4px 15px rgba(0, 0, 0, 0.08);
          }
          
          .shadow-soft-lg {
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06), 0 8px 20px rgba(0, 0, 0, 0.04);
          }
          
          .dark .shadow-soft-lg {
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18), 0 8px 20px rgba(0, 0, 0, 0.1);
          }
          
          /* 3D effect utilities */
          .effect-3d-hover {
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          
          .effect-3d-hover:hover {
            transform: translateY(-4px);
          }
          
          /* Depth utilities for card layering */
          .depth-1 {
            z-index: 1;
          }
          
          .depth-2 {
            z-index: 2;
          }
          
          .depth-3 {
            z-index: 3;
          }
          
          /* Pulse animation for notifications */
          @keyframes pulse-subtle {
            0% {
              box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4);
            }
            
            70% {
              box-shadow: 0 0 0 4px rgba(56, 189, 248, 0);
            }
            
            100% {
              box-shadow: 0 0 0 0 rgba(56, 189, 248, 0);
            }
          }
          
          .pulse-subtle {
            animation: pulse-subtle 2s infinite;
          }
        `}
      </style>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: sidebarOpen ? '290px' : '80px',
          boxShadow: isDarkMode ? '2px 0 16px rgba(0, 0, 0, 0.1)' : '2px 0 20px rgba(0, 0, 0, 0.03)'
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-200 flex flex-col border-r border-slate-200/50 dark:border-slate-700/30 relative backdrop-blur-md z-10 ${windowWidth < 768 ? 'fixed h-full' : ''}`}
      >
        {/* Logo area */}
        <div className="p-4 flex items-center h-16">
          {sidebarOpen ? (
            <div className="flex items-center">
              <div className="flex items-center justify-center mr-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-sky-500 via-indigo-500 to-teal-500 rounded-full blur-md opacity-30"></div>
                  <MdOutlineHealthAndSafety className="w-9 h-9 text-sky-500 relative z-0" />
                </div>
              </div>
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-xl font-bold bg-gradient-to-r from-sky-500 via-indigo-500 to-teal-500 text-transparent bg-clip-text relative font-satoshi"
              >
                ADPPM Healthcare
              </motion.h1>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-sky-500 via-indigo-500 to-teal-500 rounded-full blur-md opacity-30"></div>
                <MdOutlineHealthAndSafety className="w-9 h-9 text-sky-500 relative z-0" />
              </div>
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.1, rotate: -10 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            onClick={toggleSidebar}
            className={`${sidebarOpen ? 'ml-auto' : 'hidden'} p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400`}
            aria-label="Collapse sidebar"
          >
            <FiChevronsLeft className="w-5 h-5" />
          </motion.button>
        </div>
        
        {/* User profile */}
        <div className={`${sidebarOpen ? 'px-4' : 'px-2'} py-5 border-b border-slate-200/50 dark:border-slate-700/30`}>
          <div className={`flex ${sidebarOpen ? 'flex-row items-center' : 'flex-col items-center'} space-y-1`}>
            <div className="relative">
              <div className={`${sidebarOpen ? 'w-12 h-12' : 'w-10 h-10'} rounded-full bg-gradient-to-r from-sky-100 to-indigo-100 dark:from-slate-700/70 dark:to-slate-800/70 p-0.5 shadow-lg`}>
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
                  {user?.profile_image ? (
                    <img src={user.profile_image} alt={user?.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <img src={DEFAULT_AVATAR} alt={user?.full_name || 'User'} className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
              <div className={`absolute -bottom-1 -right-1 ${sidebarOpen ? 'w-5 h-5' : 'w-4 h-4'} rounded-full ${getRoleColor()} text-white flex items-center justify-center shadow-lg`}>
                {getRoleIcon()}
              </div>
            </div>
            
            {sidebarOpen && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-slate-800 dark:text-white font-satoshi">{user?.full_name || 'User'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center font-inter">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  {getRoleName()}
                </p>
              </div>
            )}
            
            {!sidebarOpen && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center truncate max-w-full px-1 font-inter">
                {user?.username || 'User'}
              </p>
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3">
          <ul className="space-y-2.5">
            {getSidebarItems().map((item, index) => (
              <NavItem
                key={index}
                icon={item.icon}
                text={item.text}
                path={item.path}
                isActive={location.pathname === item.path}
                collapsed={!sidebarOpen}
                onClick={() => navigate(item.path)}
              />
            ))}
          </ul>
        </div>
        
        {/* Bottom actions */}
        <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/30 space-y-2.5">
          <motion.button 
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
            onClick={toggleDarkMode}
            className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} w-full px-3 py-2.5 rounded-2xl transition-all duration-200 ${
              isDarkMode 
                ? 'text-amber-400 hover:bg-slate-800/60' 
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50'
            }`}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <div className="flex items-center">
              {isDarkMode ? (
                <MdOutlineLightMode className="w-5 h-5 text-amber-400" />
              ) : (
                <MdOutlineNightlight className="w-5 h-5 text-slate-500" />
              )}
              {sidebarOpen && (
                <span className="ml-3 text-sm font-medium font-satoshi">
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </span>
              )}
            </div>
            {sidebarOpen && (
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center px-0.5 relative transition-colors duration-300">
                <motion.div 
                  initial={false}
                  animate={{ 
                    x: isDarkMode ? 21 : 0,
                    backgroundColor: isDarkMode ? '#38bdf8' : '#ffffff'
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-5 h-5 rounded-full shadow-sm absolute"
                />
              </div>
            )}
          </motion.button>
          
          <motion.button 
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
            onClick={toggleSidebar}
            className={`${sidebarOpen ? '' : 'hidden'} flex items-center w-full px-3 py-2.5 rounded-2xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50 transition-all duration-200`}
          >
            <FiMenu className="w-5 h-5 text-slate-500" />
            <span className="ml-3 text-sm font-medium font-satoshi">Collapse Sidebar</span>
          </motion.button>
          
          <motion.button 
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className={`flex items-center ${sidebarOpen ? 'justify-start' : 'justify-center'} w-full px-3 py-2.5 rounded-2xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200`}
          >
            <LuLogOut className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3 text-sm font-medium font-satoshi">Logout</span>}
          </motion.button>
        </div>
        
        {/* Expand button for collapsed state */}
        {!sidebarOpen && (
          <motion.button
            whileHover={{ scale: 1.1, x: 3 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            onClick={toggleSidebar}
            className="absolute -right-3 top-20 bg-white dark:bg-slate-700 border border-slate-200/70 dark:border-slate-600/70 rounded-full p-1.5 shadow-lg text-slate-500 dark:text-slate-300"
            aria-label="Expand sidebar"
          >
            <FiChevronRight className="w-4 h-4" />
          </motion.button>
        )}
      </motion.aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${windowWidth < 768 && sidebarOpen ? 'ml-[290px]' : windowWidth < 768 && !sidebarOpen ? 'ml-[80px]' : ''}`}>
        {/* Header */}
        <header className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/30 shadow-sm z-0 h-16 sticky top-0">
          <div className="h-full px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center">
              {!sidebarOpen && (
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={toggleSidebar}
                  className="p-2 mr-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                  aria-label="Expand sidebar"
                >
                  <FiMenu className="w-5 h-5" />
                </motion.button>
              )}
              
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white truncate font-satoshi">{getPageTitle()}</h2>
              
              {/* Desktop search input */}
              <div className={`ml-6 relative ${isSearchFocused ? 'w-64 md:w-96' : 'w-48 md:w-64'} transition-all duration-300 hidden sm:block`}>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <FiSearch className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="w-full pl-10 pr-3 py-2 rounded-2xl bg-slate-100/70 dark:bg-slate-700/40 border border-slate-200/70 dark:border-slate-700/70 
                    focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 dark:focus:border-sky-500 
                    focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-sky-500/20 focus:outline-none 
                    text-base text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500
                    transition-all duration-300 font-inter"
                />
              </div>
              
              {/* Mobile search overlay */}
              <AnimatePresence>
                {isMobileSearchOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute inset-0 bg-white/95 dark:bg-slate-800/95 z-0 flex items-center px-4"
                  >
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                        <FiSearch className="w-4 h-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full pl-10 pr-3 py-2 rounded-2xl bg-slate-100/70 dark:bg-slate-700/40 border border-slate-200/70 dark:border-slate-700/70 
                          focus:bg-white dark:focus:bg-slate-700 focus:border-sky-500 dark:focus:border-sky-500 
                          focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-sky-500/20 focus:outline-none 
                          text-base text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 font-inter"
                      />
                    </div>
                    <button 
                      onClick={toggleMobileSearch}
                      className="ml-2 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center space-x-1 md:space-x-3">
              {/* Responsive search button */}
              <div className="block sm:hidden">
                <Tooltip text="Search">
                  <button 
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                    onClick={toggleMobileSearch}
                  >
                    <FiSearch className="w-5 h-5" />
                  </button>
                </Tooltip>
              </div>

              {/* Notifications dropdown */}
              <div className="relative notifications-container" ref={notificationsRef}>
                <Tooltip text="Notifications">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={toggleNotifications} 
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 relative"
                    aria-label="View notifications"
                  >
                    <FiBell className="w-5 h-5" />
                    <AnimatePresence>
                      {getUnreadCount() > 0 && (
                        <motion.span 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className={`absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center shadow-lg font-semibold ${getUnreadCount() > 0 ? 'pulse-subtle' : ''}`}
                        >
                          {getUnreadCount()}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </Tooltip>
                
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute right-0 mt-2 w-[300px] md:w-[360px] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-soft-lg overflow-hidden z-50 border border-slate-200/70 dark:border-slate-700/70"
                    >
                      <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 dark:text-white flex items-center font-satoshi">
                          <FiBell className="w-4 h-4 mr-2 text-sky-500" />
                          Notifications
                        </h3>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          onClick={markAllAsRead} 
                          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors duration-150 font-inter"
                        >
                          Mark all as read
                        </motion.button>
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map(notif => (
                            <Notification 
                              key={notif.id} 
                              notification={notif} 
                              onClick={() => markAsRead(notif.id)} 
                            />
                          ))
                        ) : (
                          <div className="py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto mb-3 flex items-center justify-center">
                              <FiSlack className="w-8 h-8 text-slate-300 dark:text-slate-500" />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-satoshi">No notifications yet</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-inter">When you receive notifications, they'll appear here</p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/80 text-center">
                        <a href="#" className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors duration-150 font-inter">
                          View all notifications
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="hidden md:block h-8 w-px bg-slate-200/70 dark:bg-slate-700/40"></div>
              
              {/* Profile dropdown trigger */}
              <div className="relative profile-dropdown-container" ref={profileDropdownRef}>
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={toggleProfileDropdown}
                  className="relative cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-sky-100 to-indigo-100 dark:from-slate-700/70 dark:to-slate-800/70 p-0.5 shadow-lg">
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
                      {user?.profile_image ? (
                        <img src={user.profile_image} alt={user?.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <img src={DEFAULT_AVATAR} alt={user?.full_name || 'User'} className="w-full h-full object-cover" />
                      )}
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"></div>
                </motion.div>
              </div>
              
              {/* Profile dropdown portal - positioned fixed to avoid stacking context issues */}
              <AnimatePresence>
                {showProfileDropdown && (
                  <div className="fixed inset-0 z-[9999] pointer-events-none">
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setShowProfileDropdown(false)}></div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="pointer-events-auto absolute right-4 top-16 w-56 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-soft-lg overflow-hidden border border-slate-200/70 dark:border-slate-700/70"
                    >
                      <div className="p-4 border-b border-slate-200/70 dark:border-slate-700/70">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 mr-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-sky-100 to-indigo-100 dark:from-slate-700/70 dark:to-slate-800/70 p-0.5 shadow-lg">
                              <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                {user?.profile_image ? (
                                  <img src={user.profile_image} alt={user?.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <img src={DEFAULT_AVATAR} alt={user?.full_name || 'User'} className="w-full h-full object-cover" />
                                )}
                              </div>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-800 dark:text-white font-satoshi">{user?.full_name || 'User'}</h3>
                            <div className="flex items-center mt-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-inter">{getRoleName()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-2">
                        <button 
                          onClick={() => {
                            setShowProfileDropdown(false);
                            setShowChangePasswordModal(true);
                          }}
                          className="flex w-full items-center rounded-xl py-2.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-all duration-200 font-satoshi"
                        >
                          <FiLock className="w-4 h-4 mr-2.5 text-slate-500 dark:text-slate-400" />
                          Change Password
                        </button>
                      </div>
                      
                      <div className="p-3 border-t border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-900/50">
                        <button 
                          onClick={handleLogout}
                          className="flex w-full items-center justify-center py-2 px-4 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all duration-200 font-inter"
                        >
                          <LuLogOut className="w-4 h-4 mr-2" />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main Content with Routes */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 relative">
          {/* Background network/grid effect for aesthetics */}
          <div className="absolute inset-0 w-full h-full bg-grid-pattern opacity-[0.02] dark:opacity-[0.03] pointer-events-none"></div>
          
          {/* Background gradient animation for depth and modern feel */}
          <div className="absolute inset-0 w-full h-full animated-gradient pointer-events-none"></div>
          
          {/* Routes container */}
          <div className="relative p-3 md:p-6 z-10 min-h-full">
            <Routes>
              {/* Doctor Routes */}
              {user?.role === 'doctor' && (
                <>
                  <Route path="/doctor" element={<PageTransition><DoctorDashboard {...sharedProps} /></PageTransition>} />
                  <Route path="/doctor/patients" element={<PageTransition><DoctorPatients {...sharedProps} /></PageTransition>} />
                  <Route path="/doctor/appointments" element={<PageTransition><DoctorAppointments {...sharedProps} /></PageTransition>} />
                  <Route path="/doctor/ai-diagnosis" element={<PageTransition><DoctorAIDiagnosis {...sharedProps} /></PageTransition>} />
                  <Route path="/doctor/patient-status" element={<PageTransition><PatientStatus {...sharedProps} /></PageTransition>} />
                  <Route path="/doctor/lab-requests" element={<PageTransition><LabRequestsDashboard {...sharedProps} /></PageTransition>} />
                  <Route path="/doctor/lab-tests" element={<PageTransition><LabTests {...sharedProps} /></PageTransition>} />
                  <Route path="/doctor/medical-reports" element={<PageTransition><DoctorMedicalReports {...sharedProps} /></PageTransition>} />
                </>
              )}

              {/* Card Room Routes */}
              {user?.role === 'cardroom' && (
                <>
                  <Route path="/cardroom" element={<PageTransition><CardRoomDashboard {...sharedProps} /></PageTransition>} />
                  <Route path="/cardroom/register-patient" element={<PageTransition><RegisterPatient {...sharedProps} /></PageTransition>} />
                  <Route path="/cardroom/patient-records" element={<PageTransition><PatientRecords {...sharedProps} /></PageTransition>} />
                  <Route path="/cardroom/appointments" element={<PageTransition><CardRoomAppointments {...sharedProps} /></PageTransition>} />
                  <Route path="/cardroom/opd-assignment" element={<PageTransition><OPDAssignment {...sharedProps} /></PageTransition>} />
                </>
              )}

              {/* Lab Routes */}
              {user?.role === 'labroom' && (
                <>
                  <Route path="/labroom" element={<PageTransition><LabDashboard {...sharedProps} /></PageTransition>} />
                  <Route path="/labroom/requests" element={<PageTransition><LabRequestsList {...sharedProps} /></PageTransition>} />
                  <Route path="/labroom/results" element={<PageTransition><TestResults {...sharedProps} /></PageTransition>} />
                  <Route path="/labroom/history" element={<PageTransition><LabHistory {...sharedProps} /></PageTransition>} />
                  <Route path="/labroom/reports" element={<PageTransition><LabReports {...sharedProps} /></PageTransition>} />
                  <Route path="/labroom/patients" element={<PageTransition><LabPatients {...sharedProps} /></PageTransition>} />
                </>
              )}

              {/* Admin Routes */}
              {user?.role === 'admin' && (
                <>
                  <Route path="/admin" element={<PageTransition><AdminDashboard {...sharedProps} /></PageTransition>} />
                  <Route path="/admin/users" element={<PageTransition><UserManagement {...sharedProps} /></PageTransition>} />
                  <Route path="/admin/analytics" element={<PageTransition><Analytics {...sharedProps} /></PageTransition>} />
                </>
              )}

              {/* Default Redirect */}
              <Route path="/" element={<Navigate to={`/dashboard/${user?.role}`} replace />} />
              <Route path="*" element={<Navigate to={`/dashboard/${user?.role}`} replace />} />
            </Routes>
          </div>
        </main>
      </div>
      
      {/* Change Password Modal */}
      <Modal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        title="Change Password"
      >
        <ChangePasswordForm 
          onSubmit={handleChangePassword}
          isLoading={isChangingPassword}
        />
      </Modal>
      
      {/* Background grid pattern via CSS */}
      <style>
        {`
          .bg-grid-pattern {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%235D5CDE' fill-opacity='0.1'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          }

          .dark .bg-grid-pattern {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%235D5CDE' fill-opacity='0.2'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          }
        `}
      </style>
    </div>
  );
}

export default Dashboard;
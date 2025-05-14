import React, { useState, useEffect, useRef } from 'react';
import {
  FiSearch,
  FiX,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiUser,
  FiCalendar,
  FiRefreshCw,
  FiFilter,
  FiChevronDown,
  FiFileText,
  FiActivity,
  FiArrowRight,
  FiHeart,
  FiTrendingUp,
  FiShield,
  FiClipboard,
  FiUserPlus,
  FiBookOpen,
  FiInfo,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiChevronRight,
  FiChevronsUp,
  FiChevronsDown,
  FiMaximize2,
  FiMinimize2,
  FiArrowUp,
  FiArrowDown,
  FiMessageCircle,
  FiHash,
  FiStar
} from 'react-icons/fi';
import { MdOutlineTimeline } from 'react-icons/md';
import axios from 'axios';
import { format, parseISO, formatDistance } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Enhanced status config with real-world medical statuses
const statusConfig = {
  registered: { 
    title: 'Registered',
    icon: <FiUserPlus />,
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-gradient-to-r from-blue-100/80 to-indigo-100/80 dark:from-blue-900/30 dark:to-indigo-900/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    description: 'Patient has been registered in the system'
  },
  assigned_opd: { 
    title: 'Assigned to OPD',
    icon: <FiClipboard />,
    color: 'from-teal-500 to-emerald-600',
    bg: 'bg-gradient-to-r from-teal-100/80 to-emerald-100/80 dark:from-teal-900/30 dark:to-emerald-900/30',
    border: 'border-teal-200 dark:border-teal-800',
    text: 'text-teal-800 dark:text-teal-200',
    description: 'Patient has been assigned to outpatient department'
  },
  in_treatment: { 
    title: 'In Treatment',
    icon: <FiActivity />,
    color: 'from-purple-500 to-fuchsia-600',
    bg: 'bg-gradient-to-r from-purple-100/80 to-fuchsia-100/80 dark:from-purple-900/30 dark:to-fuchsia-900/30',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-800 dark:text-purple-200',
    description: 'Patient is currently receiving medical treatment'
  },
  discharged: { 
    title: 'Discharged',
    icon: <FiCheckCircle />,
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-gradient-to-r from-emerald-100/80 to-teal-100/80 dark:from-emerald-900/30 dark:to-teal-900/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-800 dark:text-emerald-200',
    description: 'Patient has been discharged from care'
  },
  follow_up: { 
    title: 'Follow-up',
    icon: <FiCalendar />,
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-gradient-to-r from-amber-100/80 to-orange-100/80 dark:from-amber-900/30 dark:to-orange-900/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    description: 'Patient has a scheduled follow-up appointment'
  },
  emergency: { 
    title: 'Emergency',
    icon: <FiAlertCircle />,
    color: 'from-red-500 to-rose-600',
    bg: 'bg-gradient-to-r from-red-100/80 to-rose-100/80 dark:from-red-900/30 dark:to-rose-900/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    description: 'Patient requires immediate emergency care'
  },
  waiting: { 
    title: 'Waiting',
    icon: <FiClock />,
    color: 'from-sky-500 to-cyan-600',
    bg: 'bg-gradient-to-r from-sky-100/80 to-cyan-100/80 dark:from-sky-900/30 dark:to-cyan-900/30',
    border: 'border-sky-200 dark:border-sky-800',
    text: 'text-sky-800 dark:text-sky-200',
    description: 'Patient is waiting for appointment or service'
  },
  default: { 
    title: 'Status Update',
    icon: <FiFileText />,
    color: 'from-gray-500 to-slate-600',
    bg: 'bg-gradient-to-r from-gray-100/80 to-slate-100/80 dark:from-gray-800/50 dark:to-slate-800/50',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-800 dark:text-gray-200',
    description: 'Patient status has been updated'
  }
};

// Animation variants
const fadeInScale = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
  }
};

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
  }
};

// Slide up for modals
const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 500, damping: 30 }
  },
  exit: { 
    opacity: 0, 
    y: 20, 
    transition: { duration: 0.2 }
  }
};

// Staggered child animation
const staggerChildren = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07
    }
  }
};

const childVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
  }
};

// Format display labels for better readability
const formatLabel = (key) => {
  let label = key.replace(/_/g, ' ');
  return label.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Network Animation Component
const NetworkAnimation = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    
    // Make canvas full width/height of parent
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
      initParticles();
    };
    
    // Create particles
    const initParticles = () => {
      particles = [];
      const particleCount = Math.min(Math.floor(canvas.width * canvas.height / 10000), 70);
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 1,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          lastX: 0,
          lastY: 0
        });
      }
    };
    
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update particles
      particles.forEach(particle => {
        particle.lastX = particle.x;
        particle.lastY = particle.y;
        
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) {
          particle.speedX = -particle.speedX;
        }
        if (particle.y < 0 || particle.y > canvas.height) {
          particle.speedY = -particle.speedY;
        }
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(93, 92, 222, 0.5)';
        ctx.fill();
      });
      
      // Draw connections
      ctx.strokeStyle = 'rgba(93, 92, 222, 0.15)';
      ctx.lineWidth = 0.5;
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Initialize
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    animate();
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};

// Toast configuration
const toastConfig = {
  position: "top-right",
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: "colored",
  style: {
    borderRadius: '12px',
    fontWeight: 500
  }
};

// ID component that stylizes IDs
const StylizedId = ({ id, label = "ID" }) => {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  
  const formattedId = showFull ? id : 
    id?.length > 12 ? `${id.substring(0, 8)}...` : id;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="inline-flex items-center">
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1.5">{label}:</span>
      <div 
        className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-0.5 text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-all group cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
        onClick={() => setShowFull(!showFull)}
      >
        <span>{formattedId}</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard();
          }}
          className="opacity-50 hover:opacity-100 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          title="Copy to clipboard"
        >
          {copied ? 
            <FiCheckCircle className="h-3 w-3 text-green-500" /> :
            <FiCopy className="h-3 w-3" />
          }
        </button>
      </div>
    </div>
  );
};

// Timeline modal component
const TimelineModal = ({ isOpen, onClose, timeline, patientName }) => {
  const modalRef = useRef(null);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [sortOrder, setSortOrder] = useState('asc'); // Default to ascending (oldest first)
  
  // Toggle details view for a timeline entry
  const toggleDetails = (id) => {
    setExpandedDetails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Get status config for formatting
  const getStatusConfig = (status) => {
    const normalizedStatus = status.toLowerCase().replace(/ /g, '_');
    return statusConfig[normalizedStatus] || statusConfig.default;
  };
  
  // Format the detail icon based on the status type
  const getDetailIcon = (status, key) => {
    const statusLower = status.toLowerCase();
    
    // Icons for specific keys in different statuses
    if (key === 'registration_number') return <FiBookOpen className="h-4 w-4" />;
    if (key === 'patient_name') return <FiUser className="h-4 w-4" />;
    if (key === 'assignment_id') return <FiClipboard className="h-4 w-4" />;
    if (key === 'doctor_name') return <FiUser className="h-4 w-4" />;
    if (key === 'priority') return <FiTrendingUp className="h-4 w-4" />;
    
    // Default icon
    return <FiFileText className="h-4 w-4" />;
  };
  
  // Create a user-friendly view of priority
  const formatPriorityBadge = (priority) => {
    const priorityMap = {
      'NORMAL': {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        label: 'Normal'
      },
      'URGENT': {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        label: 'Urgent'
      },
      'EMERGENCY': {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        label: 'Emergency'
      },
      'LOW': {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        label: 'Low'
      }
    };
    
    const config = priorityMap[priority] || {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      label: priority
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  // Sort timeline entries based on the current sort order
  const sortedTimeline = [...timeline].sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });
  
  // Render details card content based on status type
  const renderStatusDetails = (status, details) => {
    switch(status) {
      case "REGISTERED":
        return (
          <div className="flex flex-col space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                <FiUser className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Patient Name</div>
                <div className="font-medium text-lg text-gray-900 dark:text-white">
                  {details.patient_name}
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                <FiBookOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Registration Number</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {details.registration_number}
                </div>
              </div>
            </div>
          </div>
        );
        
      case "ASSIGNED_OPD":
        return (
          <div className="flex flex-col space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                <FiUser className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Doctor Assigned</div>
                <div className="font-medium text-lg text-gray-900 dark:text-white">
                  Dr. {details.doctor_name}
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                <FiTrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Priority Level</div>
                <div className="font-medium text-gray-900 dark:text-white mt-1">
                  {formatPriorityBadge(details.priority)}
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                <FiClipboard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Assignment ID</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  <StylizedId id={details.assignment_id} label="Assignment" />
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${getStatusConfig(status).bg} ${getStatusConfig(status).text}`}>
                  {getDetailIcon(status, key)}
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formatLabel(key)}
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {typeof value === 'object' 
                      ? JSON.stringify(value) 
                      : String(value)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <motion.div
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={slideUp}
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="border-b border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-teal-50 dark:from-indigo-900/20 dark:to-teal-900/20">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-white dark:bg-gray-700 shadow-sm rounded-full">
              <MdOutlineTimeline className="text-teal-500 h-5 w-5" />
            </div>
            <span>Status History - {patientName}</span>
          </h3>
          
          {/* Sort order toggle */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-1 rounded-lg shadow-sm">
              <button
                onClick={() => setSortOrder('asc')}
                className={`flex items-center gap-1 px-2 py-1 rounded ${
                  sortOrder === 'asc' 
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
                title="Oldest first (Registration to Current)"
                aria-label="Sort ascending"
              >
                <FiArrowUp className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Oldest First</span>
              </button>
              <button
                onClick={() => setSortOrder('desc')}
                className={`flex items-center gap-1 px-2 py-1 rounded ${
                  sortOrder === 'desc' 
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
                title="Newest first (Current to Registration)"
                aria-label="Sort descending"
              >
                <FiArrowDown className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Newest First</span>
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors bg-white dark:bg-gray-700 shadow-sm"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto p-5 flex-grow">
          {/* Timeline Content */}
          {timeline.length <= 1 ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              No previous status entries found.
            </div>
          ) : (
            <div className="relative pl-12 pt-1">
              <div className="absolute top-0 bottom-8 left-6 w-1 bg-gradient-to-b from-indigo-300 via-teal-400 to-teal-500 dark:from-indigo-500 dark:to-teal-600 rounded-full"></div>
              
              {sortedTimeline.map((entry, idx) => {
                // Convert status to have first letter caps and remove underscores
                const status = entry.status.split('_').map(
                  word => word.charAt(0) + word.slice(1).toLowerCase()
                ).join(' ');
                
                const statusConfig = getStatusConfig(entry.status.toLowerCase());
                const entryId = `modal-entry-${idx}`;
                const isLast = idx === sortedTimeline.length - 1;
                
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }} // Faster animation
                    className={`mb-6 ${isLast ? '' : ''} relative`} // Reduced spacing
                  >
                    {/* Timeline node */}
                    <div className="absolute -left-6 top-0">
                      <div className="w-12 h-12 flex items-center justify-center rounded-full border-4 border-white dark:border-gray-800 bg-gradient-to-br from-indigo-400/80 to-teal-500/80 dark:from-indigo-500/80 dark:to-teal-600/80 shadow-md text-white">
                        {statusConfig.icon}
                      </div>
                    </div>
                    
                    {/* Entry content */}
                    <div className="ml-6">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
                        <time className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wide">
                          {format(parseISO(entry.timestamp), 'MMM d, yyyy • h:mm a')}
                        </time>
                      </div>
                      
                      <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-gradient-to-r ${statusConfig.color} text-white mb-3 shadow-sm`}>
                        {status}
                      </div>
                      
                      {/* User-friendly details card */}
                      {entry.details && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="overflow-hidden"
                        >
                          <motion.div 
                            className={`mt-2 rounded-xl border ${statusConfig.border} ${statusConfig.bg} overflow-hidden shadow-sm`}
                            whileHover={{ y: -2, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            onClick={() => toggleDetails(entryId)}
                          >
                            {/* Header with expand/collapse button */}
                            <div 
                              className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700/20 cursor-pointer"
                            >
                              <h4 className={`font-medium ${statusConfig.text}`}>
                                Status Details
                              </h4>
                              <button
                                aria-label={expandedDetails[entryId] ? "Collapse details" : "Expand details"}
                                className={`p-1 rounded-full bg-gray-50 dark:bg-gray-700 ${statusConfig.text} transition-transform duration-200 ${
                                  expandedDetails[entryId] ? 'rotate-180' : ''
                                }`}
                              >
                                <FiChevronDown className="h-4 w-4" />
                              </button>
                            </div>
                            
                            {/* Animated details content */}
                            <AnimatePresence>
                              {expandedDetails[entryId] && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="px-4 py-3"
                                >
                                  {/* Render details based on status type */}
                                  {renderStatusDetails(entry.status, entry.details)}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default function PatientStatus() {
  const { user } = useAuth();
  const doctorId = user?.id;
  
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const timelineRef = useRef(null);
  const patientScrollRef = useRef(null);
  
  // Debounced search function to prevent excessive filtering
  const handleSearch = (term) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter(patient => 
        `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredPatients(filtered);
    }
  };
  
  // Optimized patient fetch with memoization
  const fetchPatients = async (forceRefresh = false) => {
    if (!doctorId) return;
    
    // Don't refetch if we already have patients unless force refresh
    if (patients.length > 0 && !forceRefresh) return;
    
    setLoadingPatients(true);
    setError(null);
    
    try {
      const res = await axios.get('http://localhost:8024/patients', {
        params: { doctor_id: doctorId }
      });
      
      if (res.data.success) {
        setPatients(res.data.patients);
        setFilteredPatients(res.data.patients);
        if (forceRefresh) {
          toast.success("Patient list refreshed successfully", toastConfig);
        }
      } else {
        throw new Error(res.data.message || 'Failed to load patients');
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load patients", toastConfig);
      setError(e.message || "Failed to load patients");
    } finally {
      setLoadingPatients(false);
    }
  };

  // Optimized timeline fetch
  const fetchTimeline = async (patientId, forceRefresh = false) => {
    if (!doctorId || !patientId) return;
    
    setLoadingTimeline(true);
    setError(null);
    // Clear previous timeline data to prevent display of wrong patient data
    setTimeline([]);
    setCurrentStatus(null);
    
    try {
      const res = await axios.get(
        `http://localhost:8024/patients/${patientId}/status`,
        { params: { doctor_id: doctorId } }
      );
      
      if (res.data.success) {
        // Sort timeline by timestamp in descending order (newest first)
        const sortedTimeline = [...res.data.timeline].sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // Set the current status as the most recent entry
        if (sortedTimeline.length > 0) {
          setCurrentStatus(sortedTimeline[0]);
          // Remove the current status from the historical timeline
          setTimeline(sortedTimeline);
        } else {
          setTimeline([]);
        }
        
        if (forceRefresh) {
          toast.success("Timeline refreshed successfully", toastConfig);
        }
      } else {
        throw new Error(res.data.message || 'Failed to load timeline');
      }
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load timeline", toastConfig);
      setError(e.message || "Failed to load timeline");
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    if (refreshing) return; // Prevent multiple refreshes
    setRefreshing(true);
    
    try {
      if (selectedPatient) {
        await fetchTimeline(selectedPatient, true);
      } else {
        await fetchPatients(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Get status config for formatting
  const getStatusConfig = (status) => {
    const normalizedStatus = status.toLowerCase().replace(/ /g, '_');
    return statusConfig[normalizedStatus] || statusConfig.default;
  };

  // Get selected patient details
  const getSelectedPatientName = () => {
    const patient = patients.find(p => p.id === selectedPatient);
    return patient ? `${patient.first_name} ${patient.last_name}` : '';
  };

  // Scroll to the timeline after patient selection
  const scrollToTimeline = () => {
    if (timelineRef.current) {
      setTimeout(() => {
        timelineRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchPatients();
  }, [doctorId]);

  // Load timeline when patient selection changes
  useEffect(() => {
    if (selectedPatient) {
      // Always fetch fresh data when patient changes
      fetchTimeline(selectedPatient, true);
      scrollToTimeline();
    } else {
      setTimeline([]);
      setCurrentStatus(null);
    }
  }, [selectedPatient]);
  
  // Format the detail icon based on the status type
  const getDetailIcon = (status, key) => {
    const statusLower = status.toLowerCase();
    
    // Icons for specific keys in different statuses
    if (key === 'registration_number') return <FiHash className="h-4 w-4" />;
    if (key === 'patient_name') return <FiUser className="h-4 w-4" />;
    if (key === 'assignment_id') return <FiClipboard className="h-4 w-4" />;
    if (key === 'doctor_name') return <FiUser className="h-4 w-4" />;
    if (key === 'priority') return <FiTrendingUp className="h-4 w-4" />;
    
    // Default icon
    return <FiFileText className="h-4 w-4" />;
  };
  
  // Create a user-friendly view of priority
  const formatPriorityBadge = (priority) => {
    const priorityMap = {
      'NORMAL': {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        label: 'Normal'
      },
      'URGENT': {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        label: 'Urgent'
      },
      'EMERGENCY': {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        label: 'Emergency'
      },
      'LOW': {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        label: 'Low'
      }
    };
    
    const config = priorityMap[priority] || {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      label: priority
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };
  
  // Render details for current status card
  const renderCurrentStatusDetails = (status, details) => {
    switch(status) {
      case "REGISTERED":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/70 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/30">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  <FiUser className="h-4 w-4" />
                </div>
                <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Patient Name</span>
              </div>
              <div className="ml-8 font-medium text-base text-gray-900 dark:text-white">
                {details.patient_name}
              </div>
            </div>
            
            <div className="bg-white/70 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/30">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                  <FiBookOpen className="h-4 w-4" />
                </div>
                <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Registration</span>
              </div>
              <div className="ml-8">
                <StylizedId id={details.registration_number} label="Reg" />
              </div>
            </div>
          </div>
        );
        
      case "ASSIGNED_OPD":
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/70 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/30">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  <FiUser className="h-4 w-4" />
                </div>
                <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Doctor</span>
              </div>
              <div className="ml-8 font-medium text-base text-gray-900 dark:text-white">
                Dr. {details.doctor_name}
              </div>
            </div>
            
            <div className="bg-white/70 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/30">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  <FiTrendingUp className="h-4 w-4" />
                </div>
                <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Priority</span>
              </div>
              <div className="ml-8 mt-1">
                {formatPriorityBadge(details.priority)}
              </div>
            </div>
            
            <div className="bg-white/70 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/30">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  <FiClipboard className="h-4 w-4" />
                </div>
                <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Assignment</span>
              </div>
              <div className="ml-8">
                <StylizedId id={details.assignment_id} label="ID" />
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="bg-white/70 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded-full ${getStatusConfig(status).bg} ${getStatusConfig(status).text}`}>
                    {getDetailIcon(status, key)}
                  </div>
                  <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                    {formatLabel(key)}
                  </span>
                </div>
                <div className="ml-8 font-medium text-sm text-gray-900 dark:text-white">
                  {typeof value === 'object' 
                    ? JSON.stringify(value) 
                    : (key.includes('id') ? <StylizedId id={value} /> : String(value))}
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-900 font-sans transition-colors duration-300 relative overflow-hidden">
      {/* Stylized background enhancement */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-full h-64 bg-gradient-to-r from-indigo-600/10 via-blue-500/10 to-teal-500/10 dark:from-indigo-600/20 dark:via-blue-500/20 dark:to-teal-500/20 blur-3xl -z-10"></div>
      
      {/* Network animation background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <NetworkAnimation />
      </div>
      
      {/* Main content container with reduced padding */}
      <div className="relative z-10">
        <ToastContainer
          position="top-right"
          closeButton={false}
          toastClassName="!rounded-xl !shadow-lg !font-medium"
        />
        
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-5" // Reduced padding
        >
          {/* Compact header with glass effect */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="backdrop-blur-lg bg-white/70 dark:bg-gray-800/70 rounded-2xl shadow-md border border-gray-100/50 dark:border-gray-700/30 p-3 sm:p-4 mb-4" // Reduced padding
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-teal-500 text-white shadow-md">
                  <FiUserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-teal-600 dark:from-indigo-400 dark:to-teal-400 bg-clip-text text-transparent">
                    My Patient Status
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    View and monitor your patient's journey
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh data"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-700 hover:to-teal-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <FiRefreshCw className={`${refreshing ? 'animate-spin' : ''} h-4 w-4`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </motion.div>
          
          {/* Patient selection section */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInScale}
            transition={{ delay: 0.15 }}
            className="backdrop-blur-md bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100/50 dark:border-gray-700/30 overflow-hidden mb-4" // Reduced margin
            ref={patientScrollRef}
          >
            <div className="border-b border-gray-100 dark:border-gray-700/50 px-4 py-3 bg-gradient-to-r from-gray-50/80 to-gray-100/80 dark:from-gray-800/80 dark:to-gray-700/80">
              <h2 className="text-base font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                <div className="p-1.5 rounded-full bg-gradient-to-r from-indigo-100 to-indigo-200 dark:from-indigo-900/50 dark:to-indigo-800/50 text-indigo-600 dark:text-indigo-300">
                  <FiUser className="h-4 w-4" />
                </div>
                <span>Select Patient</span>
              </h2>
            </div>
            
            <div className="p-4">
              {/* Search input with glass effect */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <FiSearch className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-10 py-2.5 rounded-xl border-0 bg-gray-50/60 dark:bg-gray-700/40 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base shadow-inner focus:ring-2 focus:ring-indigo-500 focus:shadow-lg focus:bg-white dark:focus:bg-gray-700/60 transition-all duration-200"
                  placeholder="Search patients by name..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  aria-label="Search patients"
                />
                {searchTerm && (
                  <button
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => handleSearch('')}
                    aria-label="Clear search"
                  >
                    <div className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200">
                      <FiX className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                    </div>
                  </button>
                )}
              </div>
              
              {/* Patient selection grid with loading state */}
              {loadingPatients ? (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-750 rounded-xl p-3 overflow-hidden shadow animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-600"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-lg w-3/4"></div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {filteredPatients.length > 0 ? (
                    <motion.div 
                      variants={staggerChildren}
                      className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    >
                      {filteredPatients.map((patient) => (
                        <motion.div
                          key={patient.id}
                          variants={childVariant}
                          whileHover={{ 
                            scale: 1.02, 
                            y: -3,
                            transition: { type: 'spring', stiffness: 400, damping: 10 }
                          }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedPatient(patient.id);
                            setError(null);
                          }}
                          className={`relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200 border-2 ${
                            selectedPatient === patient.id 
                              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-900/20 shadow-lg' 
                              : 'border-transparent bg-white/80 dark:bg-gray-750/80 shadow-md hover:shadow-xl'
                          }`}
                        >
                          {/* Colorful accent decoration */}
                          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${
                            selectedPatient === patient.id 
                              ? 'from-indigo-500 to-teal-500'
                              : 'from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-500 group-hover:from-indigo-400 group-hover:to-teal-400'
                          } transition-colors duration-300`}></div>
                          
                          <div className="p-3">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                selectedPatient === patient.id
                                  ? 'bg-gradient-to-br from-indigo-500 to-teal-500 text-white shadow-lg'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 group-hover:bg-gradient-to-br group-hover:from-indigo-400 group-hover:to-teal-400 group-hover:text-white'
                              } transition-all duration-300`}>
                                <span className="text-base font-semibold">
                                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                                </span>
                              </div>
                              
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                                  {patient.first_name} {patient.last_name}
                                </h3>
                                {patient.id && (
                                  <div className="flex items-center mt-1">
                                    <StylizedId id={patient.id} />
                                  </div>
                                )}
                              </div>
                              
                              {selectedPatient === patient.id && (
                                <div className="absolute top-3 right-3 bg-indigo-100 dark:bg-indigo-900/60 p-1 rounded-full">
                                  <FiCheckCircle className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-8"
                    >
                      <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                        <FiSearch className="h-6 w-6 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {searchTerm ? 'No matching patients found' : 'No patients available'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        {searchTerm 
                          ? `We couldn't find any patients matching "${searchTerm}"`
                          : 'Your patient list is empty. New patients will appear here.'
                        }
                      </p>
                      
                      {searchTerm && (
                        <button 
                          onClick={() => handleSearch('')}
                          className="mt-3 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors duration-200 text-sm"
                        >
                          Clear search
                        </button>
                      )}
                    </motion.div>
                  )}
                </>
              )}
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800/50"
              >
                <div className="px-4 py-3 flex items-center gap-2 text-red-600 dark:text-red-300">
                  <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-800/50">
                    <FiAlertCircle className="h-4 w-4" />
                  </div>
                  <p className="font-medium text-sm">{error}</p>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Current Status Card - Redesigned */}
          <AnimatePresence mode="wait">
            {selectedPatient && (
              <motion.div
                key="current-status"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fadeInScale}
                className="backdrop-blur-md bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100/50 dark:border-gray-700/30 overflow-hidden"
                ref={timelineRef}
              >
                <div className="border-b border-gray-100 dark:border-gray-700/50 px-4 py-3 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-blue-50/80 dark:from-indigo-900/20 dark:to-blue-900/20">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/90 dark:bg-gray-700/90 shadow-sm">
                      <MdOutlineTimeline className="text-teal-500 h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        Current Status
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getSelectedPatientName()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {timeline.length > 1 && (
                      <button 
                        onClick={() => setTimelineModalOpen(true)}
                        className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg text-indigo-700 dark:text-indigo-300 bg-white/90 dark:bg-gray-700/90 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border border-gray-100 dark:border-gray-700/60"
                      >
                        <FiClock className="h-3 w-3" /> History
                      </button>
                    )}
                    
                    <button
                      onClick={() => setSelectedPatient('')}
                      className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg hover:bg-white/90 dark:hover:bg-gray-700/90 transition-colors border border-gray-100 dark:border-gray-700/60"
                      aria-label="Close"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {loadingTimeline ? (
                  <div className="flex items-center justify-center py-8 space-x-3">
                    <div className="h-10 w-10 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin"></div>
                    <p className="text-gray-500 dark:text-gray-400">Loading patient data...</p>
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="mx-auto relative">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3 mx-auto">
                        <MdOutlineTimeline className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="absolute top-1 right-1/3 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 border-3 border-white dark:border-gray-800 flex items-center justify-center">
                        <FiX className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No status information</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      This patient has no status updates yet. New updates will appear here when available.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Current Status Card - Redesigned for visual appeal */}
                    <div className="p-4">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="relative mb-2"
                      >
                        {/* Status header with prominent status */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-teal-500 text-white shadow-md">
                                {getStatusConfig(currentStatus.status.toLowerCase()).icon}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                                <FiClock className="h-3 w-3 text-indigo-500" />
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Current Status</div>
                              <div className="text-lg font-bold text-gray-900 dark:text-white">
                                {currentStatus.status.split('_').map(
                                  word => word.charAt(0) + word.slice(1).toLowerCase()
                                ).join(' ')}
                              </div>
                            </div>
                          </div>
                          
                          <div className="sm:ml-auto flex items-end sm:items-center flex-col sm:flex-row gap-1 sm:gap-3 text-right">
                            <div className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs flex items-center gap-1">
                              <FiClock className="h-3 w-3 text-gray-400" />
                              <span>Updated {formatDistance(new Date(currentStatus.timestamp), new Date(), { addSuffix: true })}</span>
                            </div>
                            
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {format(parseISO(currentStatus.timestamp), 'PPP')}
                            </div>
                          </div>
                        </div>
                        
                        {/* Status details in attractive cards */}
                        {renderCurrentStatusDetails(currentStatus.status, currentStatus.details)}
                      </motion.div>
                      
                      {/* History button - Always visible if there's history, but styled differently for mobile/desktop */}
                      {timeline.length > 1 && (
                        <div className="mt-4 flex justify-center">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setTimelineModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-teal-50 dark:from-indigo-900/40 dark:to-teal-900/40 text-indigo-600 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800/30 font-medium hover:shadow-md transition-all duration-200 text-sm"
                          >
                            <MdOutlineTimeline className="h-4 w-4" />
                            <span>View Status History</span>
                            <div className="flex items-center justify-center w-5 h-5 bg-indigo-100 dark:bg-indigo-800 rounded-full text-xs text-indigo-700 dark:text-indigo-300 font-semibold">
                              {timeline.length - 1}
                            </div>
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Timeline Modal (only shown when clicked) */}
          <AnimatePresence>
            {timelineModalOpen && (
              <TimelineModal 
                isOpen={timelineModalOpen}
                onClose={() => setTimelineModalOpen(false)}
                timeline={timeline}
                patientName={getSelectedPatientName()}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation
} from "react-router-dom";
import Login from "./components/auth/Login";
import Dashboardboard from './pages/Dashboardboard';
import ProtectedRoute from "./ProtectedRoute";
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { 
  FaHospital, FaHeartbeat, FaFlask, FaChartLine, FaUser, 
  FaIdCard, FaUserMd, FaNotesMedical, FaSignInAlt, FaAngleDown,
  FaLaptopMedical, FaFileMedical, FaCalendarAlt, FaBars, FaTimes,
  FaCheckCircle, FaShieldAlt, FaStethoscope, FaSun, FaMoon,
  FaArrowRight, FaArrowDown, FaPhone, FaEnvelope, FaMapMarkerAlt,
  FaLungs, FaBrain, FaBone, FaXRay, FaPrescription, FaClinicMedical,
  FaUserNurse, FaHospitalAlt, FaRegHospital, FaDna, FaMicroscope,
  FaBriefcaseMedical, FaAmbulance, FaHospitalUser, FaVirus, FaCapsules,
  FaFileUpload
} from 'react-icons/fa';
import { HiOutlineSparkles } from 'react-icons/hi';
import { IoMdPulse } from 'react-icons/io';
import { RiMentalHealthFill } from 'react-icons/ri';
import 'react-toastify/dist/ReactToastify.css';

// Load custom fonts
const fontCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');
`;

// Create a context for dark mode
const DarkModeContext = React.createContext({
  darkMode: false,
  toggleDarkMode: () => {},
});

// Dark mode provider component
const DarkModeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check if dark mode preference is stored in localStorage
    const storedDarkMode = localStorage.getItem('darkMode');
    
    if (storedDarkMode !== null) {
      // Use stored preference if available
      const isDark = storedDarkMode === 'true';
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Otherwise check system preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only update if there's no stored preference
      if (localStorage.getItem('darkMode') === null) {
        setDarkMode(e.matches);
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      
      // Store preference in localStorage
      localStorage.setItem('darkMode', String(newMode));
      
      // Update document class
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      return newMode;
    });
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};

// Custom hook to use dark mode
const useDarkMode = () => {
  const context = React.useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};

// Home/Landing Page Component
const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [selectedTab, setSelectedTab] = useState('heart');
  const [hoverFeature, setHoverFeature] = useState(null);
  const { darkMode, toggleDarkMode } = useDarkMode();
  
  const heroRef = useRef(null);
  const featureRef = useRef(null);
  const testimonialsRef = useRef(null);
  const aboutRef = useRef(null);
  
  const { scrollYProgress } = useScroll();
  const smoothScrollYProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const heroOpacity = useTransform(smoothScrollYProgress, [0, 0.2], [1, 0.8]);
  const heroScale = useTransform(smoothScrollYProgress, [0, 0.2], [1, 0.95]);
  const heroY = useTransform(smoothScrollYProgress, [0, 0.2], [0, 40]);

  // Handle scroll effects
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setIsHeroVisible(rect.bottom > 0);
      }
      
      const sections = ['home', 'features', 'roles', 'testimonials'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const offsetTop = element.offsetTop;
          const offsetHeight = element.offsetHeight;
          
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to section
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
      setIsMenuOpen(false);
    }
  };

  const featureCards = [
    {
      id: 'xray',
      title: 'Chest X‑Ray Analysis',
      icon: <FaXRay className="w-full h-full" />,
      description: 'AI-powered X-ray analysis with advanced heatmap visualization to identify potential abnormalities',
      color: 'from-blue-500 to-teal-400',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/30'
    },
    {
      id: 'brain',
      title: 'Brain MRI Analysis',
      icon: <FaBrain className="w-full h-full" />,
      description: 'Neural network-based processing of MRI scans to detect and classify neurological conditions',
      color: 'from-indigo-500 to-purple-400',
      textColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/30'
    },
    {
      id: 'symptoms',
      title: 'Symptom‑Based Prediction',
      icon: <RiMentalHealthFill className="w-full h-full" />,
      description: 'Advanced machine learning algorithm to predict potential diseases based on symptom patterns',
      color: 'from-teal-500 to-emerald-400',
      textColor: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-900/30'
    }
  ];

  return (
    <div className="font-['Inter',sans-serif] antialiased bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen transition-colors duration-300">
      {/* Custom Styles */}
      <style>{fontCss}</style>
      
      {/* Navbar */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-lg ${
        scrollY > 50 
          ? 'bg-white/90 dark:bg-slate-900/90 shadow-lg dark:shadow-slate-800/20 py-3' 
          : 'bg-transparent py-4'
      }`}>
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <motion.span 
                  className="flex items-center" 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-teal-400 dark:from-blue-400 dark:to-teal-300 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 dark:shadow-blue-400/10">
                    <IoMdPulse className="text-2xl" />
                  </div>
                  <span className="ml-3 text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500 dark:from-blue-400 dark:to-teal-300">ADPPM Healthcare</span>
                </motion.span>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="flex items-center space-x-8">
                <button 
                  onClick={() => scrollToSection('home')}
                  className={`text-sm font-medium transition-all duration-200 ${
                    activeSection === 'home' 
                      ? 'text-blue-600 dark:text-blue-400 relative after:absolute after:bottom-[-8px] after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-gradient-to-r after:from-blue-600 after:to-teal-500 dark:after:from-blue-400 dark:after:to-teal-300 after:transition-all' 
                      : 'text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400'
                  }`}
                >
                  Home
                </button>
                <button 
                  onClick={() => scrollToSection('features')}
                  className={`text-sm font-medium transition-all duration-200 ${
                    activeSection === 'features' 
                      ? 'text-blue-600 dark:text-blue-400 relative after:absolute after:bottom-[-8px] after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-gradient-to-r after:from-blue-600 after:to-teal-500 dark:after:from-blue-400 dark:after:to-teal-300 after:transition-all' 
                      : 'text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400'
                  }`}
                >
                  Features
                </button>
                <button 
                  onClick={() => scrollToSection('roles')}
                  className={`text-sm font-medium transition-all duration-200 ${
                    activeSection === 'roles' 
                      ? 'text-blue-600 dark:text-blue-400 relative after:absolute after:bottom-[-8px] after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-gradient-to-r after:from-blue-600 after:to-teal-500 dark:after:from-blue-400 dark:after:to-teal-300 after:transition-all' 
                      : 'text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400'
                  }`}
                >
                  User Roles
                </button>
                <button 
                  onClick={() => scrollToSection('testimonials')}
                  className={`text-sm font-medium transition-all duration-200 ${
                    activeSection === 'testimonials' 
                      ? 'text-blue-600 dark:text-blue-400 relative after:absolute after:bottom-[-8px] after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-gradient-to-r after:from-blue-600 after:to-teal-500 dark:after:from-blue-400 dark:after:to-teal-300 after:transition-all' 
                      : 'text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400'
                  }`}
                >
                  Testimonials
                </button>
                
                {/* Dark/Light mode toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 shadow-md dark:shadow-slate-900/40"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <FaSun className="h-4 w-4" /> : <FaMoon className="h-4 w-4" />}
                </button>
                
                <Link 
                  to="/login"
                  className="relative overflow-hidden group inline-flex items-center bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 dark:from-blue-500 dark:to-teal-400 dark:hover:from-blue-600 dark:hover:to-teal-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/25 dark:shadow-blue-500/15 font-medium text-sm"
                >
                  <span className="relative z-10 flex items-center">
                    Login <FaSignInAlt className="inline ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-700 to-teal-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                </Link>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={toggleDarkMode}
                className="p-2 mr-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 shadow-md dark:shadow-slate-900/40"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <FaSun className="h-4 w-4" /> : <FaMoon className="h-4 w-4" />}
              </button>
              
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none transition-all duration-200"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <FaTimes className="h-6 w-6" />
                ) : (
                  <FaBars className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </nav>
        
        {/* Mobile menu, show/hide based on menu state */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden"
            >
              <div className="px-2 pt-2 pb-3 space-y-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => scrollToSection('home')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${
                    activeSection === 'home'
                      ? 'bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection('features')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${
                    activeSection === 'features'
                      ? 'bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Features
                </button>
                <button
                  onClick={() => scrollToSection('roles')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${
                    activeSection === 'roles'
                      ? 'bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  User Roles
                </button>
                <button
                  onClick={() => scrollToSection('testimonials')}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${
                    activeSection === 'testimonials'
                      ? 'bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Testimonials
                </button>
                <div className="px-3 pt-2 pb-1">
                  <Link
                    to="/login"
                    className="w-full inline-flex justify-center items-center px-4 py-3 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-teal-500 shadow-lg shadow-blue-500/20"
                  >
                    Login to Dashboard <FaSignInAlt className="ml-2" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section 
          id="home" 
          ref={heroRef} 
          className="relative min-h-screen pt-28 pb-16 md:pt-32 md:pb-24 flex items-center overflow-hidden"
        >
          {/* Background Animation */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-50/80 to-white dark:from-slate-800/30 dark:to-slate-900"></div>
            
            {/* Animated Network Background */}
            <div className="absolute inset-0 z-0 opacity-20 dark:opacity-10">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <radialGradient id="networkGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="rgba(93, 92, 222, 0.3)" />
                    <stop offset="100%" stopColor="rgba(93, 92, 222, 0)" />
                  </radialGradient>
                </defs>
                <g stroke="url(#networkGradient)" fill="none" strokeWidth="0.2" className="network-lines">
                  <line x1="0" y1="10" x2="100" y2="90" className="animate-pulse-slow" />
                  <line x1="0" y1="90" x2="100" y2="10" className="animate-pulse-medium" />
                  <line x1="50" y1="0" x2="50" y2="100" className="animate-pulse-fast" />
                  <line x1="0" y1="50" x2="100" y2="50" className="animate-pulse-medium" />
                  <line x1="30" y1="0" x2="70" y2="100" className="animate-pulse-slow" />
                  <line x1="70" y1="0" x2="30" y2="100" className="animate-pulse-medium" />
                  <line x1="0" y1="30" x2="100" y2="70" className="animate-pulse-fast" />
                  <line x1="0" y1="70" x2="100" y2="30" className="animate-pulse-medium" />
                </g>
                <g className="network-nodes">
                  <circle cx="50" cy="50" r="1" fill="#5D5CDE" className="animate-pulse" />
                  <circle cx="30" cy="30" r="0.7" fill="#5D5CDE" className="animate-pulse-slow" />
                  <circle cx="70" cy="30" r="0.7" fill="#5D5CDE" className="animate-pulse-medium" />
                  <circle cx="30" cy="70" r="0.7" fill="#5D5CDE" className="animate-pulse-fast" />
                  <circle cx="70" cy="70" r="0.7" fill="#5D5CDE" className="animate-pulse-slow" />
                  <circle cx="20" cy="50" r="0.5" fill="#5D5CDE" className="animate-pulse-medium" />
                  <circle cx="80" cy="50" r="0.5" fill="#5D5CDE" className="animate-pulse-fast" />
                  <circle cx="50" cy="20" r="0.5" fill="#5D5CDE" className="animate-pulse-medium" />
                  <circle cx="50" cy="80" r="0.5" fill="#5D5CDE" className="animate-pulse-slow" />
                </g>
              </svg>
            </div>
            
            {/* Floating gradient blobs */}
            <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute top-40 right-10 w-96 h-96 bg-teal-400 dark:bg-teal-700 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-20 right-1/3 w-64 h-64 bg-purple-300 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
          </div>
          
          <motion.div 
            className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
            style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
          >
            <div className="flex flex-col lg:flex-row items-center">
              <div className="lg:w-1/2 lg:pr-12 mb-10 lg:mb-0">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0 }}
                  className="inline-block px-3 py-1 mb-6 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full tracking-widest uppercase"
                >
                  <span className="flex items-center">
                    <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                    AI-Powered Healthcare
                  </span>
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.41, 0.1, 0.15, 1.03] }}
                  className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 font-['Space_Grotesk',sans-serif]"
                >
                  Advanced <span className="inline-block relative">
                    <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-blue-500 to-teal-500 dark:from-blue-400 dark:via-blue-300 dark:to-teal-300">Healthcare</span>
                    <span className="absolute -bottom-2 left-0 w-full h-3 bg-gradient-to-r from-blue-500/20 to-teal-500/20 dark:from-blue-500/30 dark:to-teal-500/30 rounded-lg z-0"></span>
                  </span> Intelligence Platform
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1, ease: [0.41, 0.1, 0.15, 1.03] }}
                  className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 leading-relaxed"
                >
                  Revolutionize patient care with our AI-powered diagnostic tools, streamlined workflows, and comprehensive health management system designed for modern healthcare facilities.
                </motion.p>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: [0.41, 0.1, 0.15, 1.03] }}
                  className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4"
                >
                  <Link 
                    to="/login"
                    className="relative overflow-hidden group inline-flex justify-center items-center px-8 py-4 text-base font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 dark:from-blue-500 dark:to-teal-400 dark:hover:from-blue-600 dark:hover:to-teal-500 shadow-xl shadow-blue-500/25 dark:shadow-blue-500/15 transition-all duration-300 hover:translate-y-[-3px]"
                  >
                    <span className="relative z-10 flex items-center">
                      Get Started <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                    </span>
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-700 to-teal-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                  </Link>
                  <button 
                    onClick={() => scrollToSection('features')}
                    className="group inline-flex justify-center items-center px-8 py-4 text-base font-medium rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-all duration-300 hover:translate-y-[-3px] backdrop-blur-sm shadow-md"
                  >
                    <span>Learn More</span>
                    <FaArrowDown className="ml-2 group-hover:translate-y-1 transition-transform duration-200" />
                  </button>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mt-10 flex flex-wrap items-center gap-6 md:gap-8"
                >
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <div className="mr-2 p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                      <FaCheckCircle className="text-emerald-500 w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">HIPAA Compliant</span>
                  </div>
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <div className="mr-2 p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                      <FaCheckCircle className="text-emerald-500 w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">99.9% Uptime</span>
                  </div>
                  <div className="flex items-center text-slate-700 dark:text-slate-300">
                    <div className="mr-2 p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                      <FaCheckCircle className="text-emerald-500 w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Secure Data</span>
                  </div>
                </motion.div>
              </div>
              
              <div className="lg:w-1/2">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, delay: 0.2, ease: [0.41, 0.1, 0.15, 1.03] }}
                  className="relative"
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                >
                  {/* Medical Dashboard Mock */}
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-1.5 md:p-2 shadow-2xl relative overflow-hidden border border-gray-100 dark:border-slate-700">
                    {/* Reflection effect */}
                    <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white/30 to-transparent dark:from-white/10 dark:to-transparent pointer-events-none"></div>
                    
                    {/* Monitor Bezel */}
                    <div className="rounded-2xl overflow-hidden h-[450px] md:h-[500px] relative">
                      {/* Top Bar with Controls */}
                      <div className="h-8 bg-gradient-to-r from-slate-100 to-slate-100/80 dark:from-slate-700 dark:to-slate-700/80 flex items-center justify-between px-4">
                        <div className="flex space-x-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Medical AI Diagnostic System</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                          Live
                        </div>
                      </div>
                      
                      {/* Content Area */}
                      <div className="flex flex-col h-[calc(100%-2rem)]">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-teal-500 dark:from-blue-700 dark:to-teal-600 text-white p-3 flex justify-between items-center">
                          <div className="flex items-center">
                            <FaHeartbeat className="mr-2" />
                            <span className="font-bold">AI-Powered Diagnostic Hub</span>
                          </div>
                          <div className="text-xs bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        {/* Main Panel */}
                        <div className="flex flex-1 overflow-hidden">
                          {/* Sidebar */}
                          <div className="w-16 bg-slate-100 dark:bg-slate-900 flex flex-col items-center py-4 space-y-6">
                            <button 
                              onClick={() => setSelectedTab('heart')}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${selectedTab === 'heart' ? 'bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md hover:scale-110'}`}
                            >
                              <FaHeartbeat />
                            </button>
                            <button 
                              onClick={() => setSelectedTab('lungs')}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${selectedTab === 'lungs' ? 'bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md hover:scale-110'}`}
                            >
                              <FaLungs />
                            </button>
                            <button 
                              onClick={() => setSelectedTab('brain')}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${selectedTab === 'brain' ? 'bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md hover:scale-110'}`}
                            >
                              <FaBrain />
                            </button>
                            <button 
                              onClick={() => setSelectedTab('xray')}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${selectedTab === 'xray' ? 'bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md hover:scale-110'}`}
                            >
                              <FaXRay />
                            </button>
                            <button 
                              onClick={() => setSelectedTab('prescription')}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${selectedTab === 'prescription' ? 'bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md hover:scale-110'}`}
                            >
                              <FaPrescription />
                            </button>
                          </div>
                          
                          {/* Content Panel */}
                          <div className="flex-1 flex flex-col">
                            {/* Patient Info Bar */}
                            <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/70 p-2 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                              <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-teal-100 dark:from-blue-900 dark:to-teal-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold mr-2">JD</div>
                                <div>
                                  <div className="font-medium text-sm">Dr. Melat Tesfaye • Female • 42y</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">Patient ID: 392819 • Room 305</div>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <div className="text-xs px-2 py-1 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 text-green-700 dark:text-green-400 rounded-full flex items-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                                  Active
                                </div>
                                <div className="text-xs px-2 py-1 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full">Insured</div>
                              </div>
                            </div>
                            
                            {/* Main Content Area - Changes based on selected tab */}
                            <AnimatePresence mode="wait">
                              <motion.div 
                                key={selectedTab}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 bg-white dark:bg-slate-800 p-4 overflow-auto"
                              >
                                {selectedTab === 'heart' && (
                                  <div className="h-full">
                                    <div className="flex justify-between mb-3">
                                      <h3 className="font-bold text-slate-800 dark:text-white">Cardiovascular Assessment</h3>
                                      <div className="text-xs bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full flex items-center">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                                        Last Updated: 2 hours ago
                                      </div>
                                    </div>
                                    
                                    {/* Heart Rate Chart */}
                                    <div className="h-40 mb-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/70 rounded-xl p-2 relative overflow-hidden shadow-sm">
                                      <div className="absolute inset-0 flex items-center">
                                        <svg className="w-full h-20" viewBox="0 0 400 100" preserveAspectRatio="none">
                                          <path d="M0,50 L30,50 L45,20 L60,80 L75,20 L90,80 L105,50 L400,50" 
                                            stroke="url(#heartGradient)" 
                                            strokeWidth="2" 
                                            fill="none" 
                                            className="ecg-animate" />
                                          <defs>
                                            <linearGradient id="heartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                              <stop offset="0%" stopColor="#3B82F6" />
                                              <stop offset="100%" stopColor="#14B8A6" />
                                            </linearGradient>
                                          </defs>
                                        </svg>
                                      </div>
                                      <div className="absolute top-2 left-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Heart Rate: <span className="text-blue-600 dark:text-blue-400">72 BPM</span>
                                      </div>
                                    </div>
                                    
                                    {/* Vitals Grid */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Blood Pressure</div>
                                        <div className="text-lg font-bold text-blue-700 dark:text-blue-400">120/80</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                          <FaCheckCircle className="w-3 h-3 mr-1" />
                                          Normal
                                        </div>
                                      </div>
                                      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Oxygen Saturation</div>
                                        <div className="text-lg font-bold text-blue-700 dark:text-blue-400">98%</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                          <FaCheckCircle className="w-3 h-3 mr-1" />
                                          Normal
                                        </div>
                                      </div>
                                      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Temperature</div>
                                        <div className="text-lg font-bold text-blue-700 dark:text-blue-400">98.6°F</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                          <FaCheckCircle className="w-3 h-3 mr-1" />
                                          Normal
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Medical Team Consultation */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                      <div className="font-bold text-sm mb-2 text-slate-800 dark:text-white">Medical Team Notes</div>
                                      <div className="text-xs text-slate-600 dark:text-slate-300 mb-3 bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                                        Patient presents with occasional chest discomfort. ECG shows normal sinus rhythm. Recommend follow-up stress test and continued monitoring of BP.
                                      </div>
                                      <div className="flex space-x-2">
                                        <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                                          <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-1">
                                            <FaUserMd className="w-3 h-3" />
                                          </div>
                                          <span>Dr. Smith</span>
                                        </div>
                                        <div className="flex items-center text-xs text-teal-600 dark:text-teal-400">
                                          <div className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center mr-1">
                                            <FaUserNurse className="w-3 h-3" />
                                          </div>
                                          <span>Nurse Johnson</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {selectedTab === 'lungs' && (
                                  <div className="h-full">
                                    <div className="flex justify-between mb-3">
                                      <h3 className="font-bold text-slate-800 dark:text-white">Respiratory Assessment</h3>
                                      <div className="text-xs bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full flex items-center">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                                        Last Updated: 3 hours ago
                                      </div>
                                    </div>
                                    
                                    {/* Lung Visualization */}
                                    <div className="h-40 mb-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/70 rounded-xl p-2 relative overflow-hidden shadow-sm flex items-center justify-center">
                                      {/* Lung animation */}
                                      <div className="relative flex justify-center">
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 rounded-full filter blur-xl animate-pulse-slow"></div>
                                        <div className="text-blue-600 dark:text-blue-400 z-10 animate-pulse">
                                          <FaLungs className="w-16 h-16 opacity-70" />
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Respiratory Rate</div>
                                        <div className="text-lg font-bold text-blue-700 dark:text-blue-400">16/min</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                          <FaCheckCircle className="w-3 h-3 mr-1" />
                                          Normal
                                        </div>
                                      </div>
                                      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Lung Sounds</div>
                                        <div className="text-lg font-bold text-blue-700 dark:text-blue-400">Clear</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                          <FaCheckCircle className="w-3 h-3 mr-1" />
                                          Bilateral
                                        </div>
                                      </div>
                                      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">Peak Flow</div>
                                        <div className="text-lg font-bold text-blue-700 dark:text-blue-400">450 L/min</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center">
                                          <FaCheckCircle className="w-3 h-3 mr-1" />
                                          Normal
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* AI Analysis Panel for Lungs */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                      <div className="flex items-center mb-2">
                                        <div className="font-bold text-sm text-slate-800 dark:text-white">AI Analysis</div>
                                        <div className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Powered by ML</div>
                                      </div>
                                      
                                      <div className="text-xs text-slate-600 dark:text-slate-300 mb-3 bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                                        AI analysis suggests healthy lung function. No abnormalities detected in breathing pattern. Oxygen saturation levels are within normal range.
                                      </div>
                                      
                                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                        <span>Confidence Score: 96%</span>
                                        <span>Updated 3h ago</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {selectedTab === 'xray' && (
                                  <div className="h-full">
                                    <div className="flex justify-between mb-3">
                                      <h3 className="font-bold text-slate-800 dark:text-white">Chest X-Ray Analysis</h3>
                                      <div className="text-xs bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full flex items-center">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                                        Last Updated: 1 day ago
                                      </div>
                                    </div>
                                    
                                    {/* X-Ray Image with Heatmap Overlay */}
                                    <div className="h-[240px] mb-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/70 rounded-xl relative overflow-hidden shadow-sm flex items-center justify-center">
                                      <div className="relative w-full h-full flex items-center justify-center">
                                        {/* X-ray placeholder with heatmap effect */}
                                        <div className="w-[200px] h-[200px] bg-slate-800 dark:bg-slate-700 rounded-lg relative overflow-hidden flex items-center justify-center">
                                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 opacity-40"></div>
                                          
                                          {/* Lung outlines */}
                                          <svg viewBox="0 0 100 100" className="w-full h-full absolute top-0 left-0">
                                            <path d="M40,20 C30,25 25,40 25,60 C25,75 30,85 40,90 C50,85 55,75 55,60 C55,40 50,25 40,20 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                                            <path d="M60,20 C70,25 75,40 75,60 C75,75 70,85 60,90 C50,85 45,75 45,60 C45,40 50,25 60,20 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                                            
                                            {/* Heatmap spots */}
                                            <circle cx="35" cy="40" r="8" fill="url(#heatmap1)" className="animate-pulse-slow" />
                                            <circle cx="65" cy="45" r="6" fill="url(#heatmap2)" className="animate-pulse-medium" />
                                            
                                            <defs>
                                              <radialGradient id="heatmap1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.7)" />
                                                <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                                              </radialGradient>
                                              <radialGradient id="heatmap2" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.7)" />
                                                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                                              </radialGradient>
                                            </defs>
                                          </svg>
                                          
                                          <FaXRay className="w-16 h-16 text-white opacity-10" />
                                        </div>
                                        
                                        {/* AI Processing Overlay */}
                                        <div className="absolute top-3 right-3 px-2 py-1 bg-blue-600/80 text-white text-xs rounded-lg backdrop-blur-sm">
                                          AI Analysis Complete
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* AI Analysis Results */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                      <div className="flex items-center mb-2">
                                        <div className="font-bold text-sm text-slate-800 dark:text-white">AI Diagnostic Findings</div>
                                        <div className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">99.2% Accuracy</div>
                                      </div>
                                      
                                      <div className="text-xs text-slate-600 dark:text-slate-300 mb-3 bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                                        The AI has detected minor opacities in the upper right lobe (highlighted in red). This may indicate early-stage pneumonia. Additional analysis shows normal cardiac silhouette and no pleural effusion.
                                      </div>
                                      
                                      {/* Findings List */}
                                      <div className="space-y-2 mb-3">
                                        <div className="flex items-start">
                                          <div className="w-4 h-4 mt-0.5 rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                          </div>
                                          <div className="ml-2 text-xs text-slate-700 dark:text-slate-300">
                                            <span className="font-medium">Upper Right Lobe:</span> Minor opacities detected (confidence: 94%)
                                          </div>
                                        </div>
                                        <div className="flex items-start">
                                          <div className="w-4 h-4 mt-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                          </div>
                                          <div className="ml-2 text-xs text-slate-700 dark:text-slate-300">
                                            <span className="font-medium">Cardiac Silhouette:</span> Normal (confidence: 98%)
                                          </div>
                                        </div>
                                        <div className="flex items-start">
                                          <div className="w-4 h-4 mt-0.5 rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                          </div>
                                          <div className="ml-2 text-xs text-slate-700 dark:text-slate-300">
                                            <span className="font-medium">Lung Fields:</span> No pleural effusion (confidence: 99.7%)
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                        <span>Analyzed by AI v3.2.1</span>
                                        <button className="text-blue-600 dark:text-blue-400 hover:underline">View Full Report</button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {selectedTab === 'brain' && (
                                  <div className="h-full">
                                    <div className="flex justify-between mb-3">
                                      <h3 className="font-bold text-slate-800 dark:text-white">Brain MRI Analysis</h3>
                                      <div className="text-xs bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full flex items-center">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                                        Last Updated: 5 days ago
                                      </div>
                                    </div>
                                    
                                    {/* Brain MRI Visualization */}
                                    <div className="h-[240px] mb-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/70 rounded-xl relative overflow-hidden shadow-sm flex items-center justify-center">
                                      <div className="relative w-full h-full flex items-center justify-center">
                                        {/* MRI placeholder with neural network effect */}
                                        <div className="w-[200px] h-[200px] bg-slate-800 dark:bg-slate-700 rounded-lg relative overflow-hidden flex items-center justify-center">
                                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-600/10 opacity-40"></div>
                                          
                                          {/* Neural connections */}
                                          <svg viewBox="0 0 100 100" className="w-full h-full absolute top-0 left-0">
                                            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                                            
                                            {/* Neural network nodes and connections */}
                                            <g className="neural-network">
                                              <circle cx="40" cy="30" r="2" fill="rgba(139, 92, 246, 0.5)" className="animate-pulse-slow" />
                                              <circle cx="60" cy="35" r="2" fill="rgba(139, 92, 246, 0.5)" className="animate-pulse-medium" />
                                              <circle cx="45" cy="60" r="2" fill="rgba(139, 92, 246, 0.5)" className="animate-pulse-fast" />
                                              <circle cx="65" cy="65" r="2" fill="rgba(139, 92, 246, 0.5)" className="animate-pulse-slow" />
                                              <circle cx="35" cy="50" r="2" fill="rgba(139, 92, 246, 0.5)" className="animate-pulse-medium" />
                                              
                                              <line x1="40" y1="30" x2="60" y2="35" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="0.5" />
                                              <line x1="40" y1="30" x2="45" y2="60" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="0.5" />
                                              <line x1="60" y1="35" x2="65" y2="65" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="0.5" />
                                              <line x1="45" y1="60" x2="65" y2="65" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="0.5" />
                                              <line x1="35" y1="50" x2="45" y2="60" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="0.5" />
                                              <line x1="35" y1="50" x2="40" y2="30" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="0.5" />
                                            </g>
                                            
                                            {/* Highlighted region */}
                                            <circle cx="50" cy="45" r="8" fill="url(#brainHighlight)" className="animate-pulse-slow" />
                                            
                                            <defs>
                                              <radialGradient id="brainHighlight" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                                <stop offset="0%" stopColor="rgba(139, 92, 246, 0.7)" />
                                                <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
                                              </radialGradient>
                                            </defs>
                                          </svg>
                                          
                                          <FaBrain className="w-16 h-16 text-white opacity-10" />
                                        </div>
                                        
                                        {/* Processing Status */}
                                        <div className="absolute top-3 right-3 px-2 py-1 bg-indigo-600/80 text-white text-xs rounded-lg backdrop-blur-sm">
                                          Neural Analysis Complete
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Neural Network Analysis Results */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                      <div className="flex items-center mb-2">
                                        <div className="font-bold text-sm text-slate-800 dark:text-white">Neural Network Findings</div>
                                        <div className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">97.8% Accuracy</div>
                                      </div>
                                      
                                      <div className="text-xs text-slate-600 dark:text-slate-300 mb-3 bg-white/50 dark:bg-slate-800/50 p-3 rounded-lg">
                                        Neural network analysis shows normal brain tissue density and structure. No evidence of lesions, abnormal tissue growth, or structural abnormalities. Ventricle size and shape are within normal parameters.
                                      </div>
                                      
                                      {/* Regions Analysis */}
                                      <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Frontal Lobe</div>
                                          <div className="text-xs text-slate-600 dark:text-slate-300">Normal tissue density and function</div>
                                        </div>
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Temporal Lobe</div>
                                          <div className="text-xs text-slate-600 dark:text-slate-300">Normal morphology</div>
                                        </div>
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Parietal Lobe</div>
                                          <div className="text-xs text-slate-600 dark:text-slate-300">No abnormalities detected</div>
                                        </div>
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Cerebellum</div>
                                          <div className="text-xs text-slate-600 dark:text-slate-300">Normal structure and size</div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                        <span>Analyzed by NeuralNet v4.1.3</span>
                                        <button className="text-indigo-600 dark:text-indigo-400 hover:underline">View Full Report</button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {selectedTab === 'prescription' && (
                                  <div className="h-full">
                                    <div className="flex justify-between mb-3">
                                      <h3 className="font-bold text-slate-800 dark:text-white">Prescription Management</h3>
                                      <div className="text-xs bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-900/20 text-teal-700 dark:text-teal-400 px-2 py-1 rounded-full flex items-center">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5 animate-pulse"></span>
                                        Updated Today
                                      </div>
                                    </div>
                                    
                                    {/* Current Medication List */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 mb-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="font-bold text-sm text-slate-800 dark:text-white">Current Medications</div>
                                        <button className="text-xs text-teal-600 dark:text-teal-400 hover:underline">+ Add New</button>
                                      </div>
                                      
                                      <div className="space-y-3">
                                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                                          <div className="flex justify-between">
                                            <div className="font-medium text-sm text-slate-800 dark:text-white">Lisinopril 10mg</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Since: Jan 2023</div>
                                          </div>
                                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">1 tablet daily for blood pressure</div>
                                          <div className="flex items-center mt-2">
                                            <div className="text-xs px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full">Active</div>
                                            <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">Refills: 3</div>
                                          </div>
                                        </div>
                                        
                                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                                          <div className="flex justify-between">
                                            <div className="font-medium text-sm text-slate-800 dark:text-white">Atorvastatin 20mg</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Since: Mar 2023</div>
                                          </div>
                                          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">1 tablet at bedtime for cholesterol</div>
                                          <div className="flex items-center mt-2">
                                            <div className="text-xs px-2 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full">Active</div>
                                            <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">Refills: 2</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Medication Interaction Check */}
                                    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900/30 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                      <div className="flex items-center mb-3">
                                        <div className="font-bold text-sm text-slate-800 dark:text-white flex items-center">
                                          <FaShieldAlt className="mr-1.5 text-teal-500 w-3.5 h-3.5" />
                                          Interaction Analysis
                                        </div>
                                        <div className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">No Conflicts</div>
                                      </div>
                                      
                                      <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                                        Our AI has analyzed the current medication regimen and found no significant interactions or contraindications.
                                      </div>
                                      
                                      <div className="flex items-center justify-between text-xs mt-3">
                                        <button className="text-xs px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-md font-medium">Print Prescription</button>
                                        <button className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md font-medium">Send to Pharmacy</button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            </AnimatePresence>
                            
                            {/* Footer Bar */}
                            <div className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/70 p-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                              <div className="flex space-x-1">
                                <button className="text-xs px-3 py-1.5 bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-lg shadow-sm font-medium">Update</button>
                                <button className="text-xs px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg shadow-sm font-medium">Share</button>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Medical Team: Dr. Smith, Dr. Johnson, RN Martinez
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Decorative blurred elements */}
                  <div className="absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 w-20 h-20 md:w-32 md:h-32 bg-gradient-to-br from-blue-400 to-teal-500 rounded-full opacity-30 dark:opacity-20 blur-xl z-0"></div>
                  <div className="absolute -top-4 -left-4 md:-top-6 md:-left-6 w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-30 dark:opacity-20 blur-xl z-0"></div>
                </motion.div>
              </div>
            </div>
            
            {/* Floating stats */}
            <div className="max-w-5xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-white dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                  <FaHospitalUser className="w-6 h-6" />
                </div>
                <div className="text-3xl font-bold text-slate-800 dark:text-white">5.2M+</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Patients Treated</div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-white dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4">
                  <FaHospital className="w-6 h-6" />
                </div>
                <div className="text-3xl font-bold text-slate-800 dark:text-white">2,500+</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Medical Facilities</div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                  <FaUserMd className="w-6 h-6" />
                </div>
                <div className="text-3xl font-bold text-slate-800 dark:text-white">40K+</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Active Practitioners</div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white dark:bg-slate-800/70 backdrop-blur-sm rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                  <FaVirus className="w-6 h-6" />
                </div>
                <div className="text-3xl font-bold text-slate-800 dark:text-white">99.8%</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Diagnosis Accuracy</div>
              </motion.div>
            </div>
          </motion.div>
        </section>
        
        {/* AI Features Section */}
        <section id="features" className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50"></div>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
            <div className="absolute top-40 right-10 w-96 h-96 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-10 animate-blob animation-delay-1000"></div>
            <div className="absolute bottom-20 left-10 w-80 h-80 bg-teal-200 dark:bg-teal-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-10 animate-blob animation-delay-3000"></div>
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-block text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full"
              >
                AI-Powered Healthcare
              </motion.span>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-3xl md:text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 font-['Space_Grotesk',sans-serif]"
              >
                Advanced AI Diagnostic Tools
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-600 dark:text-slate-300"
              >
                Our cutting-edge AI algorithms analyze medical data with unprecedented accuracy, providing healthcare professionals with powerful diagnostic support.
              </motion.p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {featureCards.map((feature, index) => (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
                  whileHover={{ y: -10, transition: { duration: 0.2 } }}
                  onHoverStart={() => setHoverFeature(feature.id)}
                  onHoverEnd={() => setHoverFeature(null)}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 dark:from-blue-500/10 dark:to-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 relative z-10 h-full">
                    {/* Top highlight bar */}
                    <div className={`h-2 bg-gradient-to-r ${feature.color}`}></div>
                    
                    <div className="p-8">
                      <div className={`w-16 h-16 rounded-2xl ${feature.bgColor} flex items-center justify-center ${feature.textColor} mb-6 transform group-hover:scale-110 transition-transform duration-300 shadow-md mx-auto`}>
                        {feature.icon}
                      </div>
                      
                      <h3 className={`text-xl font-semibold text-center mb-4 text-slate-800 dark:text-slate-200 group-hover:${feature.textColor} transition-colors duration-300`}>
                        {feature.title}
                      </h3>
                      
                      <p className="text-slate-600 dark:text-slate-300 text-center mb-6">
                        {feature.description}
                      </p>
                      
                      <div className="flex justify-center">
                        <button 
                          className={`px-4 py-2 rounded-xl text-sm font-medium ${feature.bgColor} ${feature.textColor} transition-all duration-300 hover:shadow-md flex items-center`}
                        >
                          Learn More
                          <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* How it Works Section */}
            <div className="mt-24 max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <motion.h3 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-2xl md:text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 font-['Space_Grotesk',sans-serif]"
                >
                  How Our AI Technology Works
                </motion.h3>
                
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-slate-600 dark:text-slate-300"
                >
                  Our advanced neural networks analyze medical data to provide accurate diagnostic insights
                </motion.p>
              </div>
              
              <div className="grid md:grid-cols-4 gap-6">
                {[
                  {
                    icon: <FaFileUpload className="w-8 h-8" />,
                    title: "Data Upload",
                    desc: "Upload medical images and patient data securely",
                    color: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  },
                  {
                    icon: <FaDna className="w-8 h-8" />,
                    title: "AI Processing",
                    desc: "Neural networks analyze patterns and anomalies",
                    color: "bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                  },
                  {
                    icon: <FaMicroscope className="w-8 h-8" />,
                    title: "Result Generation",
                    desc: "Advanced algorithms identify potential conditions",
                    color: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                  },
                  {
                    icon: <FaBriefcaseMedical className="w-8 h-8" />,
                    title: "Clinical Decision",
                    desc: "Clinicians review AI insights for diagnosis",
                    color: "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                  }
                ].map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
                    className="relative"
                  >
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-100 dark:border-slate-700 h-full relative z-10">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-md transition-transform duration-200 hover:scale-110 cursor-pointer relative group">
                        <div className={`absolute inset-0 rounded-2xl ${step.color} opacity-100 group-hover:opacity-80 transition-opacity duration-200`}></div>
                        <div className="relative z-10">{step.icon}</div>
                      </div>
                      <h4 className="text-center text-xl font-semibold mb-2 text-slate-800 dark:text-slate-200">{step.title}</h4>
                      <p className="text-center text-slate-600 dark:text-slate-300 text-sm">{step.desc}</p>
                    </div>
                    
                    {/* Connection line between steps */}
                    {i < 3 && (
                      <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-blue-300 to-teal-300 dark:from-blue-700 dark:to-teal-700">
                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full bg-teal-400 dark:bg-teal-600 animate-pulse"></div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
        
        {/* Medical Team Section */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0 bg-slate-50 dark:bg-slate-800/50">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-50/90 to-slate-50 dark:from-slate-800/10 dark:to-slate-800/50"></div>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-block text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full"
              >
                Our Medical Team
              </motion.span>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-3xl md:text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 font-['Space_Grotesk',sans-serif]"
              >
                Experts Committed to Your Health
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-600 dark:text-slate-300"
              >
                Our diverse team of healthcare professionals works together to provide the highest quality of care using our advanced management system.
              </motion.p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Team Member 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 dark:from-blue-500/10 dark:to-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 relative z-10">
                  <div className="h-4 bg-gradient-to-r from-blue-600 to-teal-500"></div>
                  <div className="p-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/60 dark:to-blue-800/60 flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform duration-300">
                      <FaUserMd className="text-blue-600 dark:text-blue-400 w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-semibold text-center text-slate-800 dark:text-white mb-1">Dr. Beyene Tilahun</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400 text-center mb-3">Chief Medical Officer</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-4">Leads our team of healthcare professionals to deliver exceptional patient care.</p>
                    <div className="flex justify-center space-x-2">
                      <div className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">Cardiology</div>
                      <div className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">15+ Years</div>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {/* Team Member 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-blue-500/20 dark:from-indigo-500/10 dark:to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 relative z-10">
                  <div className="h-4 bg-gradient-to-r from-indigo-600 to-blue-500"></div>
                  <div className="p-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/60 dark:to-indigo-800/60 flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform duration-300">
                      <FaFlask className="text-indigo-600 dark:text-indigo-400 w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-semibold text-center text-slate-800 dark:text-white mb-1">Dr. Michael Chane</h3>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 text-center mb-3">Laboratory Director</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-4">Oversees all laboratory operations to ensure accurate and timely test results.</p>
                    <div className="flex justify-center space-x-2">
                      <div className="text-xs px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">Pathology</div>
                      <div className="text-xs px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full">12+ Years</div>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {/* Team Member 3 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 dark:from-teal-500/10 dark:to-emerald-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 relative z-10">
                  <div className="h-4 bg-gradient-to-r from-teal-600 to-emerald-500"></div>
                  <div className="p-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/60 dark:to-teal-800/60 flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform duration-300">
                      <FaUserNurse className="text-teal-600 dark:text-teal-400 w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-semibold text-center text-slate-800 dark:text-white mb-1">Elham Seid</h3>
                    <p className="text-sm text-teal-600 dark:text-teal-400 text-center mb-3">Head Nurse</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-4">Coordinates nursing staff and ensures all patients receive superior care.</p>
                    <div className="flex justify-center space-x-2">
                      <div className="text-xs px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full">RN, BSN</div>
                      <div className="text-xs px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full">10+ Years</div>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {/* Team Member 4 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 dark:from-purple-500/10 dark:to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 relative z-10">
                  <div className="h-4 bg-gradient-to-r from-purple-600 to-blue-500"></div>
                  <div className="p-6">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/60 dark:to-purple-800/60 flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform duration-300">
                      <FaLaptopMedical className="text-purple-600 dark:text-purple-400 w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-semibold text-center text-slate-800 dark:text-white mb-1">Abdela Mohammed</h3>
                    <p className="text-sm text-purple-600 dark:text-purple-400 text-center mb-3">Healthcare IT Director</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-4">Manages our digital systems to ensure seamless healthcare delivery.</p>
                    <div className="flex justify-center space-x-2">
                      <div className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">Health Informatics</div>
                      <div className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">8+ Years</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            
            <div className="mt-12 text-center">
              <button 
                className="group overflow-hidden relative inline-flex items-center px-6 py-3 text-sm font-medium rounded-xl text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30 transition-all duration-300 hover:shadow-lg"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-800/30 dark:to-teal-800/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="relative z-10 flex items-center">
                  Meet Our Full Team <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </span>
              </button>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50 relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute top-40 right-10 w-96 h-96 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-10 animate-blob animation-delay-1000"></div>
            <div className="absolute bottom-20 left-10 w-80 h-80 bg-teal-200 dark:bg-teal-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-10 animate-blob animation-delay-3000"></div>
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-block text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full"
              >
                Core Platform Features
              </motion.span>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-3xl md:text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 font-['Space_Grotesk',sans-serif]"
              >
                Comprehensive Healthcare Features
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-600 dark:text-slate-300"
              >
                Our platform offers a suite of powerful tools designed to optimize every aspect of healthcare management and patient care.
              </motion.p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature Cards */}
              {[
                {
                  icon: <FaLaptopMedical />,
                  title: "Real-time Lab Results",
                  desc: "Instant access to lab tests with real-time notifications and comprehensive parameter analysis.",
                  color: "from-blue-500 to-blue-600",
                  textColor: "text-blue-600 dark:text-blue-400",
                  bgColor: "bg-blue-50 dark:bg-blue-900/30",
                  items: ["Real-time result notifications", "Abnormal value highlighting", "Historical result comparison"]
                },
                {
                  icon: <FaUserMd />,
                  title: "Physician Dashboard",
                  desc: "Comprehensive physician portal for managing patients, appointments, and medical records.",
                  color: "from-indigo-500 to-blue-500",
                  textColor: "text-indigo-600 dark:text-indigo-400",
                  bgColor: "bg-indigo-50 dark:bg-indigo-900/30",
                  items: ["Patient overview with vital history", "Prescription management", "Lab order tracking"]
                },
                {
                  icon: <FaIdCard />,
                  title: "Patient Management",
                  desc: "Comprehensive patient records, history tracking, and demographic management.",
                  color: "from-blue-500 to-blue-600",
                  textColor: "text-blue-600 dark:text-blue-400",
                  bgColor: "bg-blue-50 dark:bg-blue-900/30",
                  items: ["Complete medical history", "Demographic tracking", "Insurance verification"]
                },
                {
                  icon: <FaFileMedical />,
                  title: "Electronic Medical Records",
                  desc: "Secure digital medical records with comprehensive patient history and treatment plans.",
                  color: "from-emerald-500 to-blue-500",
                  textColor: "text-emerald-600 dark:text-emerald-400",
                  bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
                  items: ["Secure document storage", "Treatment plan tracking", "Medication reconciliation"]
                },
                {
                  icon: <FaCalendarAlt />,
                  title: "Appointment Scheduling",
                  desc: "Efficient scheduling system with automated reminders and calendar integration.",
                  color: "from-amber-500 to-blue-500",
                  textColor: "text-amber-600 dark:text-amber-400",
                  bgColor: "bg-amber-50 dark:bg-amber-900/30",
                  items: ["Multi-provider scheduling", "Automated reminders", "Calendar integration"]
                },
                {
                  icon: <FaChartLine />,
                  title: "Analytics Dashboard",
                  desc: "Powerful data visualization and reporting tools for healthcare metrics and trends.",
                  color: "from-blue-500 to-indigo-500",
                  textColor: "text-blue-600 dark:text-blue-400",
                  bgColor: "bg-blue-50 dark:bg-blue-900/30",
                  items: ["Patient population insights", "Operational efficiency tracking", "Custom report generation"]
                }
              ].map((feature, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 * (index % 3 + 1) }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 dark:from-blue-500/10 dark:to-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-100 dark:border-slate-700 relative z-10 group h-full flex flex-col">
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r ${feature.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                    <div className={`rounded-2xl w-14 h-14 flex items-center justify-center ${feature.bgColor} ${feature.textColor} mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                      {feature.icon}
                    </div>
                    <h3 className={`text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200 group-hover:${feature.textColor} transition-colors duration-300`}>{feature.title}</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                      {feature.desc}
                    </p>
                    <ul className="space-y-3 mt-auto">
                      {feature.items.map((item, i) => (
                        <li key={i} className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                          <div className={`mr-3 w-6 h-6 flex-shrink-0 rounded-full ${feature.bgColor} flex items-center justify-center`}>
                            <FaCheckCircle className={`${feature.textColor} w-3.5 h-3.5`} />
                          </div>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        {/* User Roles Section */}
        <section id="roles" className="py-16 md:py-24 relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900"></div>
            <div className="absolute top-40 left-10 w-96 h-96 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-40 right-10 w-80 h-80 bg-teal-200 dark:bg-teal-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-block text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full"
              >
                Role-based Access
              </motion.span>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-3xl md:text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 font-['Space_Grotesk',sans-serif]"
              >
                Tailored for Every Healthcare Role
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-600 dark:text-slate-300"
              >
                Our platform provides specialized interfaces and tools designed for each role in your healthcare organization.
              </motion.p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Doctor Role */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 dark:from-blue-500/10 dark:to-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col group relative z-10">
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-teal-500"></div>
                  <div className="p-8 flex-grow">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 mx-auto transform group-hover:scale-110 transition-transform duration-300 shadow-md">
                      <FaUserMd className="text-2xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-center mb-5 text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">Doctors</h3>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Patient electronic medical records</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Lab result monitoring</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Prescription management</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Treatment plan creation</span>
                      </li>
                    </ul>
                  </div>
                  <div className="px-8 pb-8 mt-auto">
                    <Link 
                      to="/login" 
                      className="relative overflow-hidden group block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-center rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-300"
                    >
                      <span className="relative z-10">Doctor Login</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-blue-700 to-teal-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></span>
                    </Link>
                  </div>
                </div>
              </motion.div>
              
              {/* Lab Room Role */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-blue-500/20 dark:from-indigo-500/10 dark:to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col group relative z-10">
                  <div className="h-2 bg-gradient-to-r from-indigo-500 to-blue-600"></div>
                  <div className="p-8 flex-grow">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 mx-auto transform group-hover:scale-110 transition-transform duration-300 shadow-md">
                      <FaFlask className="text-2xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-center mb-5 text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">Lab Technicians</h3>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-indigo-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Test result management</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-indigo-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Lab order processing</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-indigo-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Sample tracking system</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-indigo-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Quality control monitoring</span>
                      </li>
                    </ul>
                  </div>
                  <div className="px-8 pb-8 mt-auto">
                    <Link 
                      to="/login" 
                      className="relative overflow-hidden group block w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-center rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-300"
                    >
                      <span className="relative z-10">Lab Login</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-blue-700 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></span>
                    </Link>
                  </div>
                </div>
              </motion.div>
              
              {/* Card Room Role */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 dark:from-blue-500/10 dark:to-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col group relative z-10">
                  <div className="h-2 bg-gradient-to-r from-blue-500 to-teal-500"></div>
                  <div className="p-8 flex-grow">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 mx-auto transform group-hover:scale-110 transition-transform duration-300 shadow-md">
                      <FaIdCard className="text-2xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-center mb-5 text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">Front Desk</h3>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Patient registration</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Appointment scheduling</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">OPD Assignment</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-blue-100 to-teal-100 dark:from-blue-900/30 dark:to-teal-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-blue-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Check-in/check-out process</span>
                      </li>
                    </ul>
                  </div>
                  <div className="px-8 pb-8 mt-auto">
                    <Link 
                      to="/login" 
                      className="relative overflow-hidden group block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-center rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-300"
                    >
                      <span className="relative z-10">Front Desk Login</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-blue-700 to-teal-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></span>
                    </Link>
                  </div>
                </div>
              </motion.div>
              
              {/* Admin Role */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 dark:from-emerald-500/10 dark:to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col group relative z-10">
                  <div className="h-2 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
                  <div className="p-8 flex-grow">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 mx-auto transform group-hover:scale-110 transition-transform duration-300 shadow-md">
                      <FaShieldAlt className="text-2xl" />
                    </div>
                    <h3 className="text-xl font-semibold text-center mb-5 text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-300">Administrators</h3>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-emerald-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">User management</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-emerald-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">System configuration</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-emerald-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Security and access control</span>
                      </li>
                      <li className="flex items-start">
                        <div className="mt-1.5 mr-3 w-4 h-4 flex-shrink-0 rounded-full bg-gradient-to-r from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 flex items-center justify-center">
                          <FaCheckCircle className="text-emerald-500 w-3 h-3" />
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-300">Analytics and reporting</span>
                      </li>
                    </ul>
                  </div>
                  <div className="px-8 pb-8 mt-auto">
                    <Link 
                      to="/login" 
                      className="relative overflow-hidden group block w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white text-center rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-300"
                    >
                      <span className="relative z-10">Admin Login</span>
                      <span className="absolute inset-0 bg-gradient-to-r from-emerald-700 to-blue-700 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></span>
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section id="testimonials" className="py-16 md:py-24 bg-slate-50 dark:bg-slate-800/30 relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/50 dark:bg-blue-900/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-blob animation-delay-3000"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-200/50 dark:bg-teal-900/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-blob animation-delay-1000"></div>
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="inline-block text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full"
              >
                Testimonials
              </motion.span>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-3xl md:text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 font-['Space_Grotesk',sans-serif]"
              >
                Trusted by Healthcare Professionals
              </motion.h2>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-600 dark:text-slate-300"
              >
                Hear what medical professionals are saying about our healthcare management system.
              </motion.p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Testimonial Cards */}
              {[
                {
                  quote: "This system has completely transformed our practice. The real-time lab results feature alone has saved us countless hours and improved patient care significantly. It's intuitive, reliable, and the support team is excellent.",
                  name: "Dr. Heyria kedr",
                  title: "Chief Medical Officer, Metro General",
                  color: "from-blue-500 to-blue-600"
                },
                {
                  quote: "As a lab technician, the streamlined workflow in this system has dramatically reduced our turnaround time. The interface is clean, and the abnormal result highlighting helps ensure critical values get immediate attention.",
                  name: "Zeynu Jemal",
                  title: "Senior Lab Technician, Northside Hospital",
                  color: "from-indigo-500 to-blue-500"
                },
                {
                  quote: "From an administrative perspective, this system provides unprecedented visibility into our operations. The analytics dashboards help us make data-driven decisions, and the role-based access controls ensure security.",
                  name: "Jemaludin Any",
                  title: "Healthcare Administrator, Eastside Medical",
                  color: "from-blue-500 to-blue-600"
                }
              ].map((testimonial, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-teal-500/20 dark:from-blue-500/10 dark:to-teal-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-100 dark:border-slate-700 relative group z-10">
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${testimonial.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                    <div className="mb-6">
                      <div className="flex space-x-1 text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <blockquote className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed relative">
                      <span className="absolute -top-4 -left-4 text-blue-100 dark:text-blue-900 opacity-30 transform scale-150">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.13456 9H5.37531C5.18122 9 5.02135 8.84 5.02135 8.64V5.76C5.02135 5.58 5.18122 5.4 5.37531 5.4H8.18482C8.36513 5.4 8.52499 5.26 8.55323 5.08C8.63383 4.5 8.95721 2.94 10.5026 2.42C10.6971 2.36 10.8352 2.16 10.8352 1.96V0.44C10.8352 0.2 10.6689 0 10.4466 0C10.3942 0 10.3419 0.02 10.2895 0.04C7.08581 1.14 5.02135 4.02 5.02135 8.64V15.42C5.02135 17.4 6.65503 19.02 8.63383 19.02H13.0185C13.2126 19.02 13.3724 18.86 13.3724 18.66V13.38C13.3724 11.02 11.5105 9.16 9.15803 9.14C9.15803 9.14 9.1439 9 9.13456 9Z" fill="currentColor"/>
                          <path d="M23.3749 1.96V0.44C23.3749 0.2 23.2086 0 22.9863 0C22.9339 0 22.8816 0.02 22.8292 0.04C19.6256 1.14 17.5611 4.02 17.5611 8.64V15.42C17.5611 17.4 19.1948 19.02 21.1736 19.02H22.6512C22.8453 19.02 23.0051 18.86 23.0051 18.66V13.38C23.0051 11.02 21.1433 9.16 18.7908 9.14C18.7908 9.14 18.7767 9 18.7673 9H14.9658C14.7717 9 14.6118 8.84 14.6118 8.64V5.76C14.6118 5.58 14.7717 5.4 14.9658 5.4H17.7894C17.9697 5.4 18.1296 5.26 18.1578 5.08C18.2384 4.5 18.5618 2.94 20.1072 2.42C20.3013 2.36 20.4394 2.16 20.4394 1.96V0.44" fill="currentColor"/>
                        </svg>
                      </span>
                      
                      "{testimonial.quote}"
                    </blockquote>
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-teal-500 dark:from-blue-500 dark:to-teal-400 overflow-hidden mr-4 shadow-md flex items-center justify-center text-white">
                        {testimonial.name.split(' ').map(name => name[0]).join('')}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{testimonial.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{testimonial.title}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-teal-600 dark:from-blue-700 dark:to-teal-700 opacity-95"></div>
            <div className="absolute top-0 left-0 right-0 h-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSIyOTgiIHZpZXdCb3g9IjAgMCAxNDQwIDI5OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAxMDcuMjI3TDE1LjcyNjMgMTAwLjk3NUMzMS40NTI2IDk1LjAxMTMgNjIuOTA1MiA4MS4zNTIzIDk0LjM1NzggOTIuODI3OUMxMjUuODExIDEwNC4zMDMgMTU3LjI2MyAxNDEuMjA0IDE4OC43MTYgMTQxLjIwNEMyMjAuMTY5IDE0MS4yMDQgMjUxLjYyMSAxMDQuMzAzIDI4My4wNzQgOTAuOTUxNkMzMTQuNTI2IDc3LjYwMDEgMzQ1Ljk3OSA4Ny43MDA3IDM3Ny40MzIgODcuNzAwN0M0MDguODg0IDg3LjcwMDcgNDQwLjMzNyA3Ny42MDAxIDQ3MS43ODkgODEuMzUyM0M1MDMuMjQyIDg1LjEwNDYgNTM0LjY5NSAxMDQuMzAzIDU2Ni4xNDcgMTA0LjMwM0M1OTcuNiAxMDQuMzAzIDYyOS4wNTMgODUuMTA0NiA2NjAuNTA1IDgxLjM1MjNDNjkxLjk1OCA3Ny42MDAxIDcyMy40MTEgOTAuOTUxNiA3NTQuODYzIDEwNC4zMDNDNzg2LjMxNiAxMTcuOTYyIDgxNy43NjkgMTMxLjEwMyA4NDkuMjIxIDEzNC44NTZDODgwLjY3NCAxMzguNjA4IDkxMi4xMjcgMTMyLjY0NCA5NDMuNTc5IDExNy45NjJDOTc1LjAzMiAxMDMuMjc5IDEwMDYuNDggNzguOTczIDEwMzcuOTQgNjUuNjIxNUMxMDY5LjM5IDUyLjI3IDExMDAuODQgNDkuODkzOCAxMTMyLjMgNTYuODk1MkMxMTYzLjc1IDYzLjg5NjcgMTE5NS4yIDgxLjM1MjMgMTIyNi42NSA4NS4xMDQ2QzEyNTguMTEgODcuNzAwNyAxMjg5LjU2IDc4Ljk3MyAxMzIxLjAxIDc0LjQ3MjZDMTM1Mi40NyA3MC45NzIxIDEzODMuOTIgNzIuNTk3NyAxNDAwIDc0LjQ3MjZMMTQxNS4zNyA3Ni4zNDc2VjI5Ny4zOEgxNDAwQzEzODMuOTIgMjk3LjM4IDEzNTIuNDcgMjk3LjM4IDEzMjEuMDEgMjk3LjM4QzEyODkuNTYgMjk3LjM4IDEyNTguMTEgMjk3LjM4IDEyMjYuNjUgMjk3LjM4QzExOTUuMiAyOTcuMzggMTE2My43NSAyOTcuMzggMTEzMi4zIDI5Ny4zOEMxMTAwLjg0IDI5Ny4zOCAxMDY5LjM5IDI5Ny4zOCAxMDM3Ljk0IDI5Ny4zOEMxMDA2LjQ4IDI5Ny4zOCA5NzUuMDMyIDI5Ny4zOCA5NDMuNTc5IDI5Ny4zOEM5MTIuMTI3IDI5Ny4zOCA4ODAuNjc0IDI5Ny4zOCA4NDkuMjIxIDI5Ny4zOEM4MTcuNzY5IDI5Ny4zOCA3ODYuMzE2IDI5Ny4zOCA3NTQuODYzIDI5Ny4zOEM3MjMuNDExIDI5Ny4zOCA2OTEuOTU4IDI5Ny4zOCA2NjAuNTA1IDI5Ny4zOEM2MjkuMDUzIDI5Ny4zOCA1OTcuNiAyOTcuMzggNTY2LjE0NyAyOTcuMzhDNTM0LjY5NSAyOTcuMzggNTAzLjI0MiAyOTcuMzggNDcxLjc4OSAyOTcuMzhDNDQwLjMzNyAyOTcuMzggNDA4Ljg4NCAyOTcuMzggMzc3LjQzMiAyOTcuMzhDMzQ1Ljk3OSAyOTcuMzggMzE0LjUyNiAyOTcuMzggMjgzLjA3NCAyOTcuMzhDMjUxLjYyMSAyOTcuMzggMjIwLjE2OSAyOTcuMzggMTg4LjcxNiAyOTcuMzhDMTU3LjI2MyAyOTcuMzggMTI1LjgxMSAyOTcuMzggOTQuMzU3OCAyOTcuMzhDNjIuOTA1MiAyOTcuMzggMzEuNDUyNiAyOTcuMzggMTUuNzI2MyAyOTcuMzhIMFYxMDcuMjI3WiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]"></div>
          </div>
          
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold mb-6 text-white font-['Space_Grotesk',sans-serif]"
            >
              Ready to Transform Your Healthcare Operations?
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-lg text-blue-50 mb-10 max-w-3xl mx-auto"
            >
              Join thousands of healthcare professionals who have streamlined their operations, improved patient care, and reduced administrative burden with our system.
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Link 
                to="/login"
                className="group relative overflow-hidden inline-flex items-center px-10 py-4 text-base font-medium rounded-xl text-blue-900 bg-white hover:bg-blue-50 shadow-xl transition-all duration-300 hover:translate-y-[-3px]"
              >
                <span className="relative z-10 flex items-center">
                  Get Started Today <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-blue-50 to-white translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
              </Link>
            </motion.div>
            
            <div className="grid md:grid-cols-3 gap-6 mt-20 text-white">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <FaStethoscope className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">24/7 Support</h3>
                <p className="text-blue-100 text-center">Our dedicated team is always available to assist you.</p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <FaShieldAlt className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">HIPAA Compliant</h3>
                <p className="text-blue-100 text-center">Your data is protected with military-grade encryption.</p>
              </div>
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <FaLaptopMedical className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Easy Integration</h3>
                <p className="text-blue-100 text-center">Seamlessly connects with your existing systems.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 pt-16 pb-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <div className="flex items-center mb-6">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-white shadow-lg">
                  <IoMdPulse className="text-xl" />
                </div>
                <span className="ml-3 text-xl font-bold text-white">ADPPM Healthcare</span>
              </div>
              <p className="text-sm mb-6 text-slate-400">
                Advancing healthcare management with innovative technology solutions designed for modern medical facilities.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-blue-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors duration-300">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"></path>
                  </svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-blue-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors duration-300">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
                  </svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-blue-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors duration-300">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd"></path>
                  </svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-blue-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors duration-300">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path>
                  </svg>
                </a>
              </div>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-5">Features</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Lab Results
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Patient Management
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Appointment Scheduling
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Electronic Medical Records
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Analytics Dashboard
                  </a>
                </li>
              </ul>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-5">Resources</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Training Videos
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Support Center
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    User Guides
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-teal-400 transition-colors text-sm flex items-center">
                    <FaArrowRight className="mr-2 h-2 w-2" />
                    Release Notes
                  </a>
                </li>
              </ul>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-5">Contact Us</h3>
              <div className="space-y-4">
                <p className="text-sm flex items-start">
                  <FaMapMarkerAlt className="h-5 w-5 mr-3 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>
                    123 Medical Plaza, Suite 500<br />Arba Minch, CA 94107
                  </span>
                </p>
                <p className="text-sm flex items-center">
                  <FaPhone className="h-5 w-5 mr-3 text-teal-400 flex-shrink-0" />
                  (+251) 917-577-381
                </p>
                <p className="text-sm flex items-center">
                  <FaEnvelope className="h-5 w-5 mr-3 text-teal-400 flex-shrink-0" />
                  ebrahimjenberu@adppm-healthcare.com
                </p>
              </div>
              <div className="mt-8">
                <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-5">Subscribe to our newsletter</h3>
                <form className="flex">
                  <input 
                    type="email" 
                    placeholder="Your email" 
                    className="px-4 py-2 w-full rounded-l-lg text-sm bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white text-sm font-medium rounded-r-lg transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 text-sm text-center text-slate-500">
            <p>© {new Date().getFullYear()} ADPPM Healthcare Solutions. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* Toast notification container */}
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#fff',
            color: '#363636',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            borderRadius: '0.75rem',
            padding: '16px',
            border: '1px solid #f0f0f0',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
            style: {
              background: 'linear-gradient(to right, rgba(16, 185, 129, 0.05), rgba(20, 184, 166, 0.05))',
              border: '1px solid rgba(16, 185, 129, 0.1)',
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
            style: {
              background: 'linear-gradient(to right, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.05))',
              border: '1px solid rgba(239, 68, 68, 0.1)',
            }
          },
        }}
      />

      {/* Add animations for page elements */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        
        .animate-blob {
          animation: blob 15s infinite;
        }
        
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-3000 {
          animation-delay: 3s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        /* Medical animations */
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
        
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
        }
        
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-7px) rotate(1deg); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        @keyframes pulse-medium {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        
        @keyframes pulse-fast {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        
        /* ECG Line Animation */
        @keyframes dash {
          from {
            stroke-dashoffset: 500;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        
        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }
        
        .animate-float-medium {
          animation: float-medium 4s ease-in-out infinite;
        }
        
        .animate-float-fast {
          animation: float-fast 3s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-pulse-medium {
          animation: pulse-medium 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-pulse-fast {
          animation: pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .ecg-animate {
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: dash 3s linear infinite;
        }
      `}</style>
      
      {/* Tailwind Configuration */}
      <script dangerouslySetInnerHTML={{
        __html: `
          tailwind.config = {
            darkMode: 'class',
            theme: {
              extend: {
                fontFamily: {
                  sans: ['Inter', 'system-ui', 'sans-serif'],
                  display: ['Space Grotesk', 'system-ui', 'sans-serif'],
                },
                colors: {
                  blue: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554',
                  },
                  teal: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                    950: '#042f2e',
                  },
                  indigo: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                    950: '#1e1b4b',
                  },
                  slate: {
                    650: '#374151',
                    750: '#2D3748',
                  }
                },
                keyframes: {
                  blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                  }
                },
                animation: {
                  'blob': 'blob 15s infinite',
                  'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }
              },
            }
          }
        `
      }} />
    </div>
  );
};

// Updated App Component with Home Route and DarkMode Provider
const App = () => {
  return (
    <DarkModeProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute allowedRoles={["doctor", "cardroom", "labroom", "admin"]}>
              <Dashboardboard />
            </ProtectedRoute>
          }
        >
          <Route
            path="doctor/*"
            element={
              <ProtectedRoute allowedRoles={["doctor"]}>
                <Dashboardboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="cardroom/*"
            element={
              <ProtectedRoute allowedRoles={["cardroom"]}>
                <Dashboardboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="labroom/*"
            element={
              <ProtectedRoute allowedRoles={["labroom"]}>
                <Dashboardboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/*"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Dashboardboard />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DarkModeProvider>
  );
};

export default App;
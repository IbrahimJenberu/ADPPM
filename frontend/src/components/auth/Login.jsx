import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation, Route, Routes, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, User, Lock, LogIn, AlertCircle, HelpCircle, Moon, Sun, ArrowLeft, Mail, Check, X, Shield, Calendar, Bell, Home } from 'react-feather';
import { useAuth } from '../../contexts/AuthContext';
import { Toaster, toast } from 'react-hot-toast';

// API configuration
const API_BASE_URL = 'http://localhost:8022'; // Empty string for relative URLs, or set to your base API URL if different

// Password Reset Request Modal Component
const PasswordResetModal = ({ isOpen, onClose, darkMode }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const modalRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const validateForm = () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return false;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // Call the password reset request API
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      // Even if the email doesn't exist, the backend returns success to prevent email enumeration
      if (response.ok) {
        setIsSuccess(true);
        console.log('Password reset request sent successfully');
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to send password reset email. Please try again.');
        console.error('Password reset request failed:', data);
      }
    } catch (err) {
      setError('An error occurred. Please check your connection and try again.');
      console.error('Password reset request error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`w-full max-w-md rounded-2xl shadow-2xl ${
              darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'
            } overflow-hidden`}
          >
            <div className={`relative overflow-hidden px-6 py-8 ${
              darkMode 
              ? 'bg-gradient-to-r from-teal-800 to-blue-800' 
              : 'bg-gradient-to-r from-teal-600 to-blue-600'
            } text-white`}>
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center">
                <div className="mr-4 rounded-full bg-white/10 p-3 shadow-lg backdrop-blur-sm">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Reset Password</h2>
                  <p className="text-sm text-blue-100">
                    Enter your email to receive a reset link
                  </p>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -bottom-6 -right-10 h-32 w-32 rounded-full bg-white opacity-10"></div>
              <div className="absolute -top-6 -left-10 h-24 w-24 rounded-full bg-white opacity-10"></div>
            </div>
            
            <div className="p-6">
              {isSuccess ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-4 text-center"
                >
                  <div className={`mb-4 rounded-full p-3 ${
                    darkMode ? 'bg-green-900/30 text-green-400 ring-1 ring-green-500/20' : 'bg-green-100 text-green-600'
                  }`}>
                    <Check className="h-6 w-6" />
                  </div>
                  <h3 className={`mb-2 text-lg font-semibold ${
                    darkMode ? 'text-white' : 'text-gray-800'
                  }`}>
                    Check your inbox
                  </h3>
                  <p className={`mb-5 ${
                    darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    If an account exists with {email}, we've sent a password reset link to that address.
                  </p>
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`rounded-xl px-6 py-2.5 text-sm font-medium shadow-lg transition-all ${
                      darkMode 
                      ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Return to login
                  </motion.button>
                </motion.div>
              ) : (
                <>
                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`overflow-hidden rounded-xl p-3 text-sm ${
                          darkMode 
                          ? 'bg-red-900/30 text-red-300 border border-red-900/50' 
                          : 'bg-red-50 text-red-700 border border-red-100'
                        }`}
                      >
                        <div className="flex items-center">
                          <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0 text-red-500" />
                          {error}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label 
                        htmlFor="reset-email" 
                        className={`mb-1.5 block text-sm font-medium ${
                          darkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        Email Address
                      </label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        </div>
                        <input
                          id="reset-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`block w-full rounded-xl border p-3 pl-10 text-base shadow-sm transition-all duration-200 
                            focus:outline-none focus:ring-2 ${
                              darkMode
                              ? 'border-gray-700 bg-gray-800 text-white focus:border-teal-500 focus:ring-teal-500/20'
                              : 'border-gray-300 bg-white text-gray-700 focus:border-teal-500 focus:ring-teal-500/20'
                            }`}
                          placeholder="Enter your email address"
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-3 pt-2">
                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ scale: isLoading ? 1 : 1.02 }}
                        whileTap={{ scale: isLoading ? 1 : 0.98 }}
                        className={`relative flex-1 overflow-hidden rounded-xl p-3 text-sm font-medium text-white shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          darkMode ? 'focus:ring-offset-gray-900' : ''
                        } ${
                          isLoading 
                            ? `cursor-not-allowed ${darkMode ? 'bg-teal-600/70' : 'bg-teal-500/70'}`
                            : `${darkMode 
                                ? 'bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500' 
                                : 'bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500'
                              } shadow-md hover:shadow-xl transition-all`
                        }`}
                      >
                        <span className={`flex items-center justify-center ${isLoading ? 'invisible' : ''}`}>
                          Send Reset Link
                        </span>
                        
                        {isLoading && (
                          <motion.div 
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="ml-2 text-sm">Processing...</span>
                          </motion.div>
                        )}
                      </motion.button>
                      
                      <motion.button
                        type="button"
                        onClick={onClose}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex-1 rounded-xl border p-3 text-sm font-medium transition-colors ${
                          darkMode 
                          ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700' 
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Password Reset Confirmation Component - kept for reference but not included in the main UI view
const PasswordResetConfirm = () => {
  // Implementation omitted for brevity
  return null;
};

// Updated Login Component with Premium UI
const Login = () => {
  // Core state management
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [formErrors, setFormErrors] = useState({ username: '', password: '' });
  const [showTooltip, setShowTooltip] = useState({ username: false, password: false });
  const [showResetModal, setShowResetModal] = useState(false);
  
  // Dark mode state with system preference detection
  const [darkMode, setDarkMode] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  // Initialize theme based on system preference
  useLayoutEffect(() => {
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDarkMode);
    
    if (prefersDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Toggle dark mode function
  const toggleDarkMode = () => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      return newMode;
    });
  };

  // Simulate app initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Monitor theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setDarkMode(e.matches);
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const validateForm = () => {
    const errors = { username: '', password: '' };
    let isValid = true;

    if (!username.trim()) {
      errors.username = 'Username is required';
      isValid = false;
    }

    if (!password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (!validateForm()) {
      return;
    }
  
    setError('');
    setIsLoading(true);
  
    try {
      await login(username, password);
      toast.success('Login successful', {
        duration: 3000,
        icon: '👨‍⚕️',
        style: darkMode ? {
          background: '#2D3748',
          color: '#fff'
        } : undefined
      });
      setIsLoading(false);
    } catch (err) {
      setError(typeof err.message === 'string' ? err.message : 'Failed to login. Please check your credentials.');
      toast.error('Login failed', {
        duration: 3000,
        style: darkMode ? {
          background: '#2D3748',
          color: '#fff'
        } : undefined
      });
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const quickLogin = (role) => {
    const accounts = {
      admin: { username: 'admin', password: 'admin123' },
      doctor: { username: 'tamagn', password: 'Tamagn123' },
      cardroom: { username: 'mesfin', password: 'Mesfin123' },
      labroom: { username: 'labtech6', password: 'Labtech123' }
    };
    
    setUsername(accounts[role].username);
    setPassword(accounts[role].password);
    // Clear any errors when auto-filling
    setFormErrors({ username: '', password: '' });
    setError('');
    
    // Show a toast notification
    toast.success(`Demo credentials loaded for ${role}`, {
      duration: 2000,
      style: darkMode ? {
        background: '#2D3748',
        color: '#fff'
      } : undefined
    });
  };

  // Premium initialization screen with sophisticated animation
  if (isInitializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-teal-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative flex flex-col items-center"
        >
          {/* Background rings */}
          <motion.div 
            className="absolute -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            <motion.div 
              className="h-60 w-60 rounded-full border border-teal-200/30 dark:border-teal-900/30"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute inset-0 h-60 w-60 rounded-full border border-blue-200/40 dark:border-blue-900/40"
              animate={{ scale: [1.1, 1.15, 1.1] }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.5 }}
            />
            <motion.div 
              className="absolute inset-0 h-60 w-60 rounded-full border border-purple-200/30 dark:border-purple-900/30"
              animate={{ scale: [1.2, 1.25, 1.2] }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 1 }}
            />
          </motion.div>
          
          <div className="mb-8 h-20 w-20 rounded-2xl bg-gradient-to-br from-teal-500 via-blue-500 to-purple-500 p-4 shadow-lg">
            <motion.div 
              animate={{ 
                rotate: [0, 5, 0, -5, 0],
                scale: [1, 1.05, 1, 1.05, 1]
              }}
              transition={{ 
                duration: 2, 
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.5
              }}
            >
              <LogIn className="h-full w-full text-white" />
            </motion.div>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-800 dark:text-white">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              ADPPM Healthcare
            </motion.span>
          </h1>
          <div className="relative h-2 w-56 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-300 ${
      darkMode 
      ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white' 
      : 'bg-gradient-to-br from-teal-50 via-blue-50 to-purple-50 text-gray-900'
    }`}>
      {/* Toast notifications container */}
      <Toaster position="top-right" />
      
      {/* Password Reset Modal */}
      <PasswordResetModal 
        isOpen={showResetModal} 
        onClose={() => setShowResetModal(false)} 
        darkMode={darkMode} 
      />
      
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div 
          className={`absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br opacity-30 ${
            darkMode ? 'from-teal-900/20 to-blue-900/20' : 'from-teal-200/50 to-blue-200/50'
          }`}
          animate={{ 
            scale: [1, 1.1, 1],
            x: [0, 10, 0],
            y: [0, -10, 0],
          }}
          transition={{ 
            duration: 10,
            repeat: Infinity,
            repeatType: "reverse" 
          }}
        />
        <motion.div 
          className={`absolute bottom-0 left-0 h-96 w-96 rounded-full bg-gradient-to-tr opacity-30 ${
            darkMode ? 'from-purple-900/20 to-blue-900/20' : 'from-purple-200/50 to-blue-200/50'
          }`}
          animate={{ 
            scale: [1, 1.05, 1],
            x: [0, -20, 0],
            y: [0, 20, 0],
          }}
          transition={{ 
            duration: 12,
            repeat: Infinity,
            repeatType: "reverse" 
          }}
        />
      </div>
      
      {/* Navigation buttons in the top right */}
      <div className="fixed right-6 top-6 flex items-center space-x-3">
        {/* Home button */}
        <motion.button
          onClick={() => navigate('/')}
          whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
          whileTap={{ scale: 0.95 }}
          className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all duration-300 
            ${darkMode 
              ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700' 
              : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          aria-label="Go to home page"
        >
          <Home className="h-4 w-4" />
        </motion.button>
        
        {/* Dark mode toggle */}
        <motion.button
          onClick={toggleDarkMode}
          whileHover={{ scale: 1.05, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
          whileTap={{ scale: 0.95 }}
          className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all duration-300 
            ${darkMode 
              ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700' 
              : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </motion.button>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`w-full max-w-md overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 ${
          darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'
        }`}
      >
        <div className={`relative overflow-hidden px-8 py-8 text-white ${
          darkMode 
          ? 'bg-gradient-to-r from-teal-800 via-blue-800 to-purple-800' 
          : 'bg-gradient-to-r from-teal-600 via-blue-600 to-purple-600'
        }`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative z-10 flex flex-col items-center"
          >
            <motion.div 
              className="flex justify-center mb-3"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="rounded-xl bg-white/10 p-2.5 shadow-lg backdrop-blur-sm">
                <Shield className="h-6 w-6" />
              </div>
            </motion.div>
            <h2 className="text-center text-2xl font-bold tracking-tight">ADPPM Healthcare</h2>
            <p className="mt-2 text-center text-blue-100">Welcome back! Please sign in to your account</p>
          </motion.div>
          
          {/* Background abstract shapes */}
          <div className="absolute -bottom-6 -right-10 h-32 w-32 rounded-full bg-white opacity-10"></div>
          <div className="absolute -top-6 -left-10 h-24 w-24 rounded-full bg-white opacity-10"></div>
          <div className="absolute bottom-0 right-1/4 h-16 w-16 rounded-full bg-white opacity-5"></div>
        </div>
        
        <div className="p-6">
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
                className={`overflow-hidden rounded-xl p-3 text-sm ${
                  darkMode 
                  ? 'bg-red-900/30 text-red-300 border border-red-900/50' 
                  : 'bg-red-50 text-red-700 border border-red-100'
                }`}
              >
                <div className="flex items-center">
                  <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="username" className={`block text-sm font-medium ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Username
                </label>
                <div className="relative">
                  <button 
                    type="button"
                    aria-label="Username help"
                    onClick={() => setShowTooltip({...showTooltip, username: !showTooltip.username})}
                    className={`rounded-full p-1 ${
                      darkMode 
                      ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-800' 
                      : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100'
                    } focus:outline-none transition-colors`}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  <AnimatePresence>
                    {showTooltip.username && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute bottom-full right-0 mb-2 w-48 rounded-xl bg-gray-800 p-2.5 text-xs text-white shadow-xl z-10"
                      >
                        Enter your username provided by the administrator.
                        <div className="absolute -bottom-1 right-1 h-2 w-2 rotate-45 bg-gray-800"></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (formErrors.username) {
                      setFormErrors({...formErrors, username: ''});
                    }
                  }}
                  className={`block w-full rounded-xl border p-3 pl-10 text-base shadow-sm transition-all duration-200 
                    focus:outline-none focus:ring-2 ${
                      darkMode
                      ? 'border-gray-700 bg-gray-800 text-white focus:border-teal-500 focus:ring-teal-500/20'
                      : 'border-gray-300 bg-white text-gray-700 focus:border-teal-500 focus:ring-teal-500/20'
                    }
                    ${formErrors.username ? 
                      darkMode 
                        ? 'border-red-500 ring-2 ring-red-800/30' 
                        : 'border-red-500 ring-2 ring-red-200' 
                      : ''
                    }`}
                  placeholder="Enter your username"
                  aria-invalid={!!formErrors.username}
                  aria-describedby={formErrors.username ? "username-error" : undefined}
                />
              </div>
              <AnimatePresence>
                {formErrors.username && (
                  <motion.p 
                    id="username-error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-1.5 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'} flex items-center`}
                    role="alert"
                  >
                    <AlertCircle className="mr-1.5 h-4 w-4 flex-shrink-0" />
                    {formErrors.username}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className={`block text-sm font-medium ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Password
                </label>
                <div className="relative">
                  <button 
                    type="button"
                    aria-label="Password help"
                    onClick={() => setShowTooltip({...showTooltip, password: !showTooltip.password})}
                    className={`rounded-full p-1 ${
                      darkMode 
                      ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-800' 
                      : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100'
                    } focus:outline-none transition-colors`}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  <AnimatePresence>
                    {showTooltip.password && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute bottom-full right-0 mb-2 w-64 rounded-xl bg-gray-800 p-2.5 text-xs text-white shadow-xl z-10"
                      >
                        Strong passwords combine uppercase & lowercase letters, numbers, and special characters.
                        <div className="absolute -bottom-1 right-1 h-2 w-2 rotate-45 bg-gray-800"></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className={`h-5 w-5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) {
                      setFormErrors({...formErrors, password: ''});
                    }
                  }}
                  className={`block w-full rounded-xl border p-3 pl-10 pr-10 text-base shadow-sm transition-all duration-200 
                    focus:outline-none focus:ring-2 ${
                      darkMode
                      ? 'border-gray-700 bg-gray-800 text-white focus:border-teal-500 focus:ring-teal-500/20'
                      : 'border-gray-300 bg-white text-gray-700 focus:border-teal-500 focus:ring-teal-500/20'
                    }
                    ${formErrors.password ? 
                      darkMode 
                        ? 'border-red-500 ring-2 ring-red-800/30' 
                        : 'border-red-500 ring-2 ring-red-200' 
                      : ''
                    }`}
                  placeholder="Enter your password"
                  aria-invalid={!!formErrors.password}
                  aria-describedby={formErrors.password ? "password-error" : undefined}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className={`rounded-full p-1.5 ${
                      darkMode 
                      ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-700' 
                      : 'text-gray-400 hover:text-gray-500 hover:bg-gray-100'
                    } focus:outline-none transition-colors`}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {formErrors.password && (
                  <motion.p 
                    id="password-error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-1.5 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'} flex items-center`}
                    role="alert"
                  >
                    <AlertCircle className="mr-1.5 h-4 w-4 flex-shrink-0" />
                    {formErrors.password}
                  </motion.p>
                )}
              </AnimatePresence>
              
              {/* Forgot password link - properly positioned below password field */}
              <div className="mt-2 flex justify-end">
                <motion.button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  whileHover={{ x: 2 }}
                  className={`text-xs font-medium transition-colors flex items-center ${
                    darkMode ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'
                  }`}
                >
                  Forgot password?
                </motion.button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.02, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className={`relative mt-2 w-full overflow-hidden rounded-xl p-3 text-base font-medium text-white shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                darkMode ? 'focus:ring-offset-gray-900' : ''
              } ${
                isLoading 
                  ? `cursor-not-allowed ${darkMode ? 'bg-teal-600/70' : 'bg-teal-500/70'}`
                  : `${darkMode 
                      ? 'bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500' 
                      : 'bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500'
                    }`
              }`}
            >
              <span className={`flex items-center justify-center ${isLoading ? 'invisible' : ''}`}>
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </span>
              
              {isLoading && (
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-2">Signing in...</span>
                </motion.div>
              )}
            </motion.button>
            
            <div className="mt-3 pt-2">
              <div className="flex items-center justify-center space-x-2">
                <div className={`h-px flex-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                <span className={`text-center text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Demo Accounts
                </span>
                <div className={`h-px flex-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              </div>
              
              {/* Horizontal demo accounts with fixed layout */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { role: 'admin', icon: <User className="mr-1 h-3 w-3" /> },
                  { role: 'doctor', icon: <Shield className="mr-1 h-3 w-3" /> },
                  { role: 'cardroom', icon: <Calendar className="mr-1 h-3 w-3" /> },
                  { role: 'labroom', icon: <Bell className="mr-1 h-3 w-3" /> }
                ].map(({ role, icon }) => (
                  <motion.button
                    key={role}
                    onClick={() => quickLogin(role)}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`rounded-lg px-1 py-1.5 text-xs font-medium capitalize transition-colors 
                    flex items-center justify-center shadow-sm ${
                      darkMode 
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 hover:border-gray-600' 
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {icon}
                    <span className="ml-1 truncate">{role}</span>
                  </motion.button>
                ))}
              </div>
              <p className={`mt-2 text-center text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Click any role above to auto-fill credentials
              </p>
            </div>
          </form>
        </div>
        
        <div className={`border-t px-8 py-4 transition-colors ${
          darkMode 
          ? 'border-gray-800 bg-gray-900/80' 
          : 'border-gray-100 bg-gray-50'
        }`}>
          <p className={`text-center text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            &copy; {new Date().getFullYear()} ADPPM Healthcare. All rights reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// Component to set up routes
const ResetPasswordRoutes = () => {
  return (
    <Routes>
      <Route path="/reset-password" element={<PasswordResetConfirm />} />
      {/* Other routes would be defined here */}
    </Routes>
  );
};

// Export the Login component as default
export default Login;
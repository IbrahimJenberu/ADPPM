import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useInView } from 'framer-motion';

// Icons component - maintaining proper SVG namespace
const Icons = {
  Search: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  View: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  Filter: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
    </svg>
  ),
  Close: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  ),
  Check: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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
  Doctor: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
    </svg>
  ),
  Calendar: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  StatusCheck: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  EmptySearch: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-20 h-20"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  BloodDrop: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  Phone: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  ),
  Email: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  ),
  Location: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  ),
  Emergency: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  ),
  Warning: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  Date: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  ClearFilter: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
  ArrowDown: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  ),
  ArrowUp: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
  ),
  Shield: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ),
  Network: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  Heart: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  ),
  Plus: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  ChevronRight: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  ),
  Error: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  Refresh: props => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={props.className || "w-5 h-5"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
};

// Utility function to debounce search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Network animation background component
const NetworkBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10 dark:opacity-[0.03] pointer-events-none">
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]">
        <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
            </pattern>
            <linearGradient id="network-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(79, 70, 229, 0.3)" />
              <stop offset="50%" stopColor="rgba(16, 185, 129, 0.3)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.3)" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" stroke="url(#network-gradient)" />
        </svg>
      </div>
      
      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-indigo-600/20 dark:bg-indigo-500/20"
          style={{
            width: Math.random() * 8 + 2 + 'px',
            height: Math.random() * 8 + 2 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
          }}
          animate={{
            x: [0, Math.random() * 80 - 40],
            y: [0, Math.random() * 80 - 40],
            scale: [1, Math.random() * 0.5 + 0.5, 1],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: Math.random() * 20 + 10,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}
      
      {/* Connection lines */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={`line-${i}`}
          className="absolute h-px bg-gradient-to-r from-indigo-500/0 via-indigo-500/30 to-indigo-500/0 dark:from-indigo-400/0 dark:via-indigo-400/20 dark:to-indigo-400/0"
          style={{
            width: Math.random() * 250 + 50 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
          animate={{
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: Math.random() * 10 + 5,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

// Utility function to highlight search term in text
const HighlightText = ({ text, searchTerm }) => {
  if (!searchTerm.trim() || !text) return <span>{text}</span>;

  const parts = String(text).split(new RegExp(`(${searchTerm})`, 'gi'));
  
  return (
    <span>
      {parts.map((part, index) => 
        part.toLowerCase() === searchTerm.toLowerCase() ? 
          <mark key={index} className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 px-0.5 rounded-sm">{part}</mark> : 
          <span key={index}>{part}</span>
      )}
    </span>
  );
};

// Toast Notification Component
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
    const baseClasses = "fixed top-4 right-4 z-50 flex items-center p-4 rounded-xl shadow-xl backdrop-blur-md border border-white/10";
    switch(type) {
      case 'success': 
        return `${baseClasses} bg-gradient-to-r from-emerald-500/95 to-green-600/95 text-white dark:from-emerald-600/95 dark:to-green-700/95`;
      case 'error':
        return `${baseClasses} bg-gradient-to-r from-red-500/95 to-rose-600/95 text-white dark:from-red-600/95 dark:to-rose-700/95`;
      case 'warning':
        return `${baseClasses} bg-gradient-to-r from-amber-500/95 to-orange-600/95 text-white dark:from-amber-600/95 dark:to-orange-700/95`;
      default:
        return `${baseClasses} bg-gradient-to-r from-indigo-500/95 to-blue-600/95 text-white dark:from-indigo-600/95 dark:to-blue-700/95`;
    }
  };

  const getIcon = () => {
    switch(type) {
      case 'success': return <Icons.Check className="w-5 h-5" />;
      case 'error': return <Icons.Error className="w-5 h-5" />;
      case 'warning': return <Icons.Warning className="w-5 h-5" />;
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

// Patient Modal (View Details) with enhanced UI
const PatientModal = ({ isOpen, onClose, patient = null }) => {
  const drawer = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { type: 'spring', damping: 30, stiffness: 300, duration: 0.5 }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { type: 'spring', damping: 35, stiffness: 300, duration: 0.5 }
    }
  };

  const overlay = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  const calculateAge = (dob) => {
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const age = new Date(difference);
    return Math.abs(age.getUTCFullYear() - 1970);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatPhoneNumber = (phoneNumber) => {
    return phoneNumber || 'N/A';
  };

  // Animation variants for fields
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom) => ({ 
      opacity: 1, 
      y: 0, 
      transition: { delay: custom * 0.1, duration: 0.5 } 
    })
  };

  // Generate a gender-specific background gradient
  const getGenderGradient = (gender) => {
    if (!gender) return 'from-indigo-500 to-blue-500';
    
    switch(gender.toUpperCase()) {
      case 'MALE':
        return 'from-indigo-500 to-blue-500';
      case 'FEMALE':
        return 'from-purple-500 to-pink-500';
      default:
        return 'from-teal-500 to-cyan-500';
    }
  };

  if (!patient) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={overlay}
        >
          <motion.div
            className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl rounded-2xl"
            variants={drawer}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Header with patient basic info */}
            <div className="relative pt-6 pb-12 px-6 bg-gradient-to-r from-indigo-600 to-blue-700 dark:from-indigo-800 dark:to-blue-900 overflow-hidden">
              {/* Abstract background pattern */}
              <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="dots-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="white" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#dots-pattern)" />
                </svg>
              </div>
              
              {/* Close button */}
              <motion.button 
                onClick={() => onClose(false)} 
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white backdrop-blur-md border border-white/20 z-10"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close"
              >
                <Icons.Close className="w-5 h-5" />
              </motion.button>
              
              <motion.div 
                className="flex items-center space-x-4 mb-2 relative"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={0}
              >
                <div className="h-16 w-16 flex-shrink-0 relative">
                  <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${getGenderGradient(patient.gender)} opacity-50 blur-md`}></div>
                  <div className="relative h-full w-full rounded-full bg-gradient-to-br from-white/80 to-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-xl shadow-lg border border-white/20">
                    {patient.first_name?.charAt(0)}{patient.last_name?.charAt(0)}
                  </div>
                </div>
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white border border-white/10 backdrop-blur-sm mb-1">
                    <Icons.StatusCheck className="w-3 h-3 mr-1" />
                    Registered
                  </span>
                  <h2 
                    id="drawer-title" 
                    className="text-xl font-bold text-white tracking-tight"
                  >
                    {`${patient.first_name} ${patient.last_name}`}
                  </h2>
                  <div className="flex items-center gap-2 text-white/80 text-xs mt-0.5">
                    <Icons.Doctor className="w-3.5 h-3.5" />
                    <span>Patient ID: {patient.registration_number}</span>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Content area with patient details */}
            <div className="-mt-8 pb-6 px-6 relative z-10">
              <motion.div 
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-xl mb-4 border border-gray-100 dark:border-gray-700"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={1}
              >
                <div className="flex flex-wrap gap-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col items-center justify-center flex-1 min-w-[100px]">
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Age</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{calculateAge(patient.date_of_birth)}</span>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400">years</span>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col items-center justify-center flex-1 min-w-[100px]">
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Gender</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{patient.gender}</span>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col items-center justify-center flex-1 min-w-[100px]">
                    <span className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">Blood</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{patient.blood_group || 'N/A'}</span>
                  </div>
                </div>
              </motion.div>

              <div className="space-y-4">
                <motion.div 
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-100 dark:border-gray-700"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  custom={2}
                >
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Icons.Date className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Personal Information
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Date of Birth</span>
                      <span className="text-gray-900 dark:text-white">{formatDate(patient.date_of_birth)}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Email</span>
                      <span className="text-gray-900 dark:text-white break-all">{patient.email || 'Not specified'}</span>
                    </div>
                    
                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Phone</span>
                      <span className="text-gray-900 dark:text-white">{formatPhoneNumber(patient.phone_number)}</span>
                    </div>
                    
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Address</span>
                      <span className="text-gray-900 dark:text-white">{patient.address || 'Not specified'}</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-100 dark:border-gray-700"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  custom={3}
                >
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Icons.Emergency className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Emergency Contact
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Name</span>
                      <span className="text-gray-900 dark:text-white">{patient.emergency_contact_name || 'Not specified'}</span>
                    </div>
                    
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Phone</span>
                      <span className="text-gray-900 dark:text-white">{formatPhoneNumber(patient.emergency_contact_phone)}</span>
                    </div>
                  </div>
                </motion.div>

                {patient.allergies && patient.allergies.length > 0 && (
                  <motion.div 
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-100 dark:border-gray-700"
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    custom={4}
                  >
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <Icons.Warning className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                      Allergies
                    </h3>
                    
                    <div className="flex flex-wrap gap-2">
                      {patient.allergies.map((allergy, index) => (
                        allergy ? (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800/30">
                            <Icons.Warning className="w-3 h-3 mr-1" />
                            {allergy}
                          </span>
                        ) : null
                      ))}
                      {!patient.allergies.some(a => a) && (
                        <span className="text-gray-600 dark:text-gray-400 text-sm">No allergies recorded</span>
                      )}
                    </div>
                  </motion.div>
                )}
                
                <motion.div 
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-100 dark:border-gray-700"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  custom={5}
                >
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <Icons.Calendar className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                    Registration Information
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Created At</span>
                      <span className="text-gray-900 dark:text-white">{formatDate(patient.created_at)}</span>
                    </div>
                    
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Last Updated</span>
                      <span className="text-gray-900 dark:text-white">{formatDate(patient.updated_at)}</span>
                    </div>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="pt-2 text-center"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  custom={6}
                >
                  <motion.button
                    type="button"
                    onClick={() => onClose(false)}
                    className="px-5 py-2 font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Close
                  </motion.button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Skeleton loader components with enhanced animations
const SkeletonPatientRow = () => {
  return (
    <motion.tr 
      className="border-b border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-6 py-4 whitespace-nowrap">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
        </td>
      ))}
    </motion.tr>
  );
};

const SkeletonLoader = () => {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mb-4"></div>
      
      <div className="overflow-hidden rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {[...Array(7)].map((_, i) => (
                  <th key={i} className="px-6 py-3 text-left">
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-md animate-pulse w-20"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <SkeletonPatientRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700">
          <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded-md animate-pulse w-1/3"></div>
        </div>
      </div>
    </div>
  );
};

// Error State component
const ErrorState = ({ message, onRetry }) => {
  return (
    <motion.div 
      className="p-12 flex flex-col items-center justify-center text-center bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
        className="relative mb-8"
      >
        <motion.div
          className="text-red-500 dark:text-red-400"
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
          <Icons.Error className="w-24 h-24" />
        </motion.div>
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full filter blur-2xl"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
      </motion.div>
      
      <motion.h3 
        className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3 font-sans tracking-tight"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Something went wrong
      </motion.h3>
      
      <motion.p 
        className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-lg mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {message || "We couldn't load the patient data. Please try again later."}
      </motion.p>
      
      <motion.button
        onClick={onRetry}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="px-5 py-3 font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Icons.Refresh className="w-5 h-5 mr-2" />
        Retry
      </motion.button>
    </motion.div>
  );
};

// Empty Search Results Animation
const EmptySearchResults = ({ searchTerm }) => {
  return (
    <motion.div 
      className="p-12 flex flex-col items-center justify-center text-center bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
        className="relative mb-8"
      >
        <motion.div
          className="text-indigo-300 dark:text-indigo-700"
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
          <Icons.EmptySearch className="w-28 h-28 md:w-36 md:h-36" />
        </motion.div>
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-full filter blur-2xl"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
      </motion.div>
      
      <motion.h3 
        className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3 font-sans tracking-tight"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        No patient records found
      </motion.h3>
      
      <motion.p 
        className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-lg"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {searchTerm ? (
          <>No results matching <span className="font-medium text-indigo-600 dark:text-indigo-400">"{searchTerm}"</span>. Try adjusting your search term or filters.</>
        ) : (
          <>No patient records available at this time.</>
        )}
      </motion.p>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <motion.div 
          className="inline-flex space-x-2"
          animate={{ 
            y: [0, -5, 0],
          }}
          transition={{ 
            duration: 1.5,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut"
          }}
        >
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// Filter Badge Component
const FilterBadge = ({ label, value, onRemove }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/30 mr-2 mb-2 shadow-sm"
    >
      <span>{label}: {value}</span>
      <button
        onClick={onRemove}
        className="ml-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
        aria-label={`Remove ${label} filter`}
      >
        <Icons.Close className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// Filter dropdown component
const FilterDropdown = ({ 
  isOpen, 
  onClose, 
  filters, 
  onApplyFilters, 
  availableGenders, 
  availableBloodGroups 
}) => {
  const [localFilters, setLocalFilters] = useState({ ...filters });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLocalFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setLocalFilters({
      gender: '',
      bloodGroup: '',
      minAge: '',
      maxAge: '',
    });
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const dropdownVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 25 
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.2 } 
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  // Ensure we include FEMALE and OTHER in the gender options if not in the data
  const allGenders = useMemo(() => {
    const genderSet = new Set(availableGenders);
    const defaultGenders = ['MALE', 'FEMALE', 'OTHER'];
    defaultGenders.forEach(gender => genderSet.add(gender));
    return Array.from(genderSet).filter(Boolean).sort();
  }, [availableGenders]);

  // Standard blood groups if not in the data
  const allBloodGroups = useMemo(() => {
    const bloodGroupSet = new Set(availableBloodGroups);
    const defaultBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    defaultBloodGroups.forEach(group => bloodGroupSet.add(group));
    return Array.from(bloodGroupSet).filter(Boolean).sort();
  }, [availableBloodGroups]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="fixed inset-0 z-20 bg-transparent"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />
          <motion.div
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 z-30 overflow-hidden"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <Icons.Filter className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Filter Patients
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Icons.Close className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={localFilters.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors shadow-sm"
                  >
                    <option value="">All Genders</option>
                    {allGenders.map(gender => (
                      <option key={gender} value={gender}>{gender}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="bloodGroup" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Blood Group
                  </label>
                  <select
                    id="bloodGroup"
                    name="bloodGroup"
                    value={localFilters.bloodGroup}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors shadow-sm"
                  >
                    <option value="">All Blood Groups</option>
                    {allBloodGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="minAge" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min Age
                    </label>
                    <input
                      type="number"
                      id="minAge"
                      name="minAge"
                      min="0"
                      max="120"
                      value={localFilters.minAge}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors shadow-sm"
                      placeholder="Min"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxAge" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Age
                    </label>
                    <input
                      type="number"
                      id="maxAge"
                      name="maxAge"
                      min="0"
                      max="120"
                      value={localFilters.maxAge}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors shadow-sm"
                      placeholder="Max"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between pt-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleReset}
                    className="px-5 py-2.5 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Reset All
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 8px 25px -5px rgba(79, 70, 229, 0.3)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleApply}
                    className="px-5 py-2.5 text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
                  >
                    Apply Filters
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Patient Table Sorting Header
const TableHeader = ({ label, sortKey, currentSort, onSort }) => {
  const isSorted = currentSort.key === sortKey;
  const direction = isSorted ? (currentSort.direction === 'asc' ? 'asc' : 'desc') : null;
  
  const handleClick = () => {
    const newDirection = !isSorted ? 'asc' : direction === 'asc' ? 'desc' : 'asc';
    onSort(sortKey, newDirection);
  };
  
  return (
    <th 
      scope="col" 
      className="px-6 py-5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 cursor-pointer group"
      onClick={handleClick}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        <div className="opacity-0 group-hover:opacity-50 transition-opacity duration-200 text-gray-500 dark:text-gray-400">
          {isSorted ? (
            direction === 'asc' ? <Icons.ArrowUp className="w-3.5 h-3.5" /> : <Icons.ArrowDown className="w-3.5 h-3.5" />
          ) : (
            <Icons.ArrowDown className="w-3.5 h-3.5" />
          )}
        </div>
        {isSorted && (
          <div className="opacity-100 text-indigo-600 dark:text-indigo-400">
            {direction === 'asc' ? <Icons.ArrowUp className="w-3.5 h-3.5" /> : <Icons.ArrowDown className="w-3.5 h-3.5" />}
          </div>
        )}
      </div>
    </th>
  );
};

// Patient Row with enhanced animations and styling
const PatientRow = ({ patient, onView, searchTerm = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const rowRef = useRef(null);
  const isInView = useInView(rowRef, { once: true, amount: 0.3 });

  const calculateAge = (dob) => {
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const age = new Date(difference);
    return Math.abs(age.getUTCFullYear() - 1970);
  };

  const getStatusClass = () => {
    if (patient.is_deleted) {
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200 dark:border-gray-800/30";
    }
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30";
  };

  const getStatus = () => {
    return patient.is_deleted ? "Inactive" : "Registered";
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Generate a gender-specific background gradient
  const getGenderGradient = (gender) => {
    if (!gender) return 'from-indigo-500 to-blue-500';
    
    switch(gender.toUpperCase()) {
      case 'MALE':
        return 'from-indigo-500 to-blue-500';
      case 'FEMALE':
        return 'from-purple-500 to-pink-500';
      default:
        return 'from-teal-500 to-cyan-500';
    }
  };

  // Row animation variants
  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring",
        stiffness: 100,
        damping: 20
      }
    }
  };

  return (
    <motion.tr 
      ref={rowRef}
      className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50/80 dark:hover:bg-gray-700/70 transition-colors duration-200"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      variants={rowVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      layout
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
          <HighlightText text={patient.registration_number || patient.id.substring(0, 8)} searchTerm={searchTerm} />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="h-9 w-9 flex-shrink-0 mr-3 relative">
            <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${getGenderGradient(patient.gender)} opacity-50 blur-sm`}></div>
            <div className="relative h-full w-full rounded-full bg-gradient-to-br from-white/90 to-white/60 dark:from-gray-700/90 dark:to-gray-700/60 backdrop-blur flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-medium text-sm shadow-md border border-white/20 dark:border-gray-600/20">
              {patient.first_name?.charAt(0)}{patient.last_name?.charAt(0)}
            </div>
          </div>
          <div className="font-medium text-gray-900 dark:text-white">
            <HighlightText text={`${patient.first_name} ${patient.last_name}`} searchTerm={searchTerm} />
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
        {calculateAge(patient.date_of_birth)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
        <HighlightText text={patient.gender} searchTerm={searchTerm} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
        <HighlightText text={patient.blood_group} searchTerm={searchTerm} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusClass()}`}>
          <Icons.StatusCheck className="w-3.5 h-3.5 mr-1" />
          <HighlightText text={getStatus()} searchTerm={searchTerm} />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center">
          <motion.button
            onClick={() => onView(patient)}
            className="p-2 rounded-full text-indigo-600 hover:text-white hover:bg-indigo-600 dark:text-indigo-400 dark:hover:text-white dark:hover:bg-indigo-600 transition-colors duration-200 shadow-sm hover:shadow-md"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="View Details"
            aria-label="View patient details"
          >
            <Icons.View className="w-5 h-5" />
          </motion.button>
        </div>
      </td>
    </motion.tr>
  );
};

// Enhanced Pagination component with animations
const Pagination = ({ pagination, onPageChange }) => {
  const getPageNumbers = () => {
    const maxPages = Math.min(5, pagination.pages);
    let startPage = Math.max(1, pagination.page - 2);
    let endPage = startPage + maxPages - 1;
    
    if (endPage > pagination.pages) {
      endPage = pagination.pages;
      startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };
  
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">{(pagination.page - 1) * pagination.page_size + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(pagination.page * pagination.page_size, pagination.total)}
            </span>{' '}
            of <span className="font-medium">{pagination.total}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-xl overflow-hidden shadow-sm" aria-label="Pagination">
            <motion.button
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              disabled={pagination.page === 1}
              className={`relative inline-flex items-center px-3 py-2 ${
                pagination.page === 1
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80'
              } focus:z-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200`}
              whileHover={pagination.page !== 1 ? { scale: 1.05 } : {}}
              whileTap={pagination.page !== 1 ? { scale: 0.95 } : {}}
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </motion.button>
            
            {getPageNumbers().map(pageNum => (
              <motion.button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-medium focus:z-20 ${
                  pagination.page === pageNum
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-200 dark:border-indigo-500'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80'
                } transition-colors duration-200`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {pageNum}
              </motion.button>
            ))}
            
            <motion.button
              onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
              disabled={pagination.page === pagination.pages}
              className={`relative inline-flex items-center px-3 py-2 ${
                pagination.page === pagination.pages
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80'
              } focus:z-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200`}
              whileHover={pagination.page !== pagination.pages ? { scale: 1.05 } : {}}
              whileTap={pagination.page !== pagination.pages ? { scale: 0.95 } : {}}
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </nav>
        </div>
      </div>
      
      {/* Mobile pagination */}
      <div className="flex items-center justify-between w-full sm:hidden">
        <motion.button
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={pagination.page === 1}
          className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl ${
            pagination.page === 1
              ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
              : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          } shadow-sm transition-colors duration-200`}
          whileHover={pagination.page !== 1 ? { scale: 1.05 } : {}}
          whileTap={pagination.page !== 1 ? { scale: 0.95 } : {}}
        >
          Previous
        </motion.button>
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          Page {pagination.page} of {pagination.pages}
        </span>
        <motion.button
          onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
          disabled={pagination.page === pagination.pages}
          className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl ${
            pagination.page === pagination.pages
              ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
              : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          } shadow-sm transition-colors duration-200`}
          whileHover={pagination.page !== pagination.pages ? { scale: 1.05 } : {}}
          whileTap={pagination.page !== pagination.pages ? { scale: 0.95 } : {}}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
};

// Updated Hero Section with reduced size
const HeroSection = () => {
  return (
    <motion.div 
      className="relative w-full py-3 flex flex-col items-center justify-center mb-4 overflow-hidden rounded-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-sky-500/5 dark:from-indigo-900/20 dark:via-violet-900/20 dark:to-sky-900/20 z-0">
        <NetworkBackground />
      </div>
      
      <div className="relative z-10 text-center max-w-4xl px-4 py-2">
        <motion.h1 
          className="text-2xl md:text-3xl font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 dark:from-indigo-300 dark:via-blue-300 dark:to-cyan-300 tracking-tight leading-tight font-sans"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          Patient Records Management
        </motion.h1>
      </div>
      
      {/* Gradient overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-gray-900 to-transparent pointer-events-none"></div>
    </motion.div>
  );
};

// Custom hook for fetching patients data
const usePatients = (searchTerm, filters, sort) => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    pages: 1,
  });

  // Fetch patient data from API
  const fetchPatients = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:8023/api/patients/?page=${page}&page_size=${pagination.page_size}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setPatients(data.data);
      setPagination({
        page: data.page,
        page_size: data.page_size,
        total: data.total,
        pages: data.pages,
      });
      
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch patients:", err);
      setError(err.message || "Failed to load patient data. Please try again.");
      setLoading(false);
    }
  }, [pagination.page_size]);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    fetchPatients(newPage);
  }, [fetchPatients]);

  // Fetch patients when component mounts
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Filter and sort patients based on search term and active filters
  useEffect(() => {
    if (!patients.length) return;
    
    let result = [...patients];
    
    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(patient => 
        patient.first_name.toLowerCase().includes(searchLower) ||
        patient.last_name.toLowerCase().includes(searchLower) ||
        patient.registration_number?.toLowerCase().includes(searchLower) ||
        patient.gender?.toLowerCase().includes(searchLower) ||
        patient.blood_group?.toLowerCase().includes(searchLower) ||
        patient.email?.toLowerCase().includes(searchLower) ||
        patient.phone_number?.includes(searchLower)
      );
    }
    
    // Apply filters
    if (filters.gender) {
      result = result.filter(patient => patient.gender === filters.gender);
    }
    
    if (filters.bloodGroup) {
      result = result.filter(patient => patient.blood_group === filters.bloodGroup);
    }
    
    if (filters.minAge) {
      const minAgeDate = new Date();
      minAgeDate.setFullYear(minAgeDate.getFullYear() - parseInt(filters.minAge));
      result = result.filter(patient => new Date(patient.date_of_birth) <= minAgeDate);
    }
    
    if (filters.maxAge) {
      const maxAgeDate = new Date();
      maxAgeDate.setFullYear(maxAgeDate.getFullYear() - parseInt(filters.maxAge));
      result = result.filter(patient => new Date(patient.date_of_birth) >= maxAgeDate);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let valueA, valueB;
      
      switch (sort.key) {
        case 'id':
          valueA = a.registration_number;
          valueB = b.registration_number;
          break;
        case 'name':
          valueA = `${a.first_name} ${a.last_name}`.toLowerCase();
          valueB = `${b.first_name} ${b.last_name}`.toLowerCase();
          break;
        case 'age': {
          const getBirthDate = dob => new Date(dob).getTime();
          valueA = getBirthDate(a.date_of_birth);
          valueB = getBirthDate(b.date_of_birth);
          break;
        }
        case 'gender':
          valueA = a.gender?.toLowerCase();
          valueB = b.gender?.toLowerCase();
          break;
        case 'bloodGroup':
          valueA = a.blood_group;
          valueB = b.blood_group;
          break;
        default:
          valueA = a.created_at;
          valueB = b.created_at;
          break;
      }
      
      if (!valueA) valueA = '';
      if (!valueB) valueB = '';
      
      const compareResult = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      return sort.direction === 'asc' ? compareResult : -compareResult;
    });
    
    setFilteredPatients(result);
  }, [patients, searchTerm, filters, sort]);

  // Get unique genders and blood groups from data
  const availableGenders = useMemo(() => {
    return [...new Set(patients.map(p => p.gender))]
      .filter(Boolean)
      .sort();
  }, [patients]);
  
  const availableBloodGroups = useMemo(() => {
    return [...new Set(patients.map(p => p.blood_group))]
      .filter(Boolean)
      .sort();
  }, [patients]);

  return {
    patients, 
    filteredPatients, 
    loading, 
    error, 
    pagination, 
    handlePageChange, 
    availableGenders, 
    availableBloodGroups,
    fetchPatients
  };
};

// Main PatientRecords component
const PatientRecords = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [toast, setToast] = useState(null);
  const [patientModal, setPatientModal] = useState({ isOpen: false, patient: null });
  const [darkMode, setDarkMode] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    gender: '',
    bloodGroup: '',
    minAge: '',
    maxAge: '',
  });
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  
  const filterButtonRef = useRef(null);

  // Custom hook for patient data
  const { 
    filteredPatients, 
    loading, 
    error, 
    pagination, 
    handlePageChange, 
    availableGenders, 
    availableBloodGroups,
    fetchPatients
  } = usePatients(debouncedSearchTerm, activeFilters, sort);

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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleViewPatient = (patient) => {
    setPatientModal({ isOpen: true, patient });
  };

  const handleModalClose = () => {
    setPatientModal({ isOpen: false, patient: null });
  };

  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
    
    // Show toast when filters are applied
    const activeFilterCount = Object.values(filters).filter(v => v !== '').length;
    if (activeFilterCount > 0) {
      showToast(`Applied ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}`, 'success');
    }
  };

  const handleRemoveFilter = (filterKey) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: ''
    }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({
      gender: '',
      bloodGroup: '',
      minAge: '',
      maxAge: '',
    });
    showToast('All filters cleared', 'info');
  };

  const handleSort = (key, direction) => {
    setSort({ key, direction });
  };

  const handleRetry = () => {
    fetchPatients(pagination.page);
  };

  // Get current page patients
  const getCurrentPagePatients = () => {
    return filteredPatients;
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return Object.values(activeFilters).some(value => value !== '');
  };

  // Framer Motion variants for staggered animations
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  // Table headers with the fields we want to display
  const tableHeaders = [
    { id: 'id', label: 'Patient ID', sortKey: 'id' },
    { id: 'name', label: 'Patient Name', sortKey: 'name' },
    { id: 'age', label: 'Age', sortKey: 'age' },
    { id: 'gender', label: 'Gender', sortKey: 'gender' },
    { id: 'bloodGroup', label: 'Blood Group', sortKey: 'bloodGroup' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: 'Actions' }
  ];

  // Determine if we should show the empty state
  const showEmptyState = !loading && !error && filteredPatients.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300 font-sans">
      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      
      {/* Patient modal */}
      <PatientModal
        isOpen={patientModal.isOpen}
        onClose={handleModalClose}
        patient={patientModal.patient}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative">
        {/* Hero section - reduced height */}
        <HeroSection />
        
        {/* Main content section */}
        <section id="patients" className="pb-6">
          <div className="relative">
            {/* Section title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <div>
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
                >
                  <span className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                    <Icons.Doctor className="w-4 h-4" />
                  </span>
                  Patient Directory
                </motion.h2>
                <motion.p 
                  className="text-sm text-gray-600 dark:text-gray-400 mt-1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  View, search and manage all registered patients
                </motion.p>
              </div>
              
              <motion.div 
                className="w-full sm:w-auto flex flex-col sm:flex-row gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Icons.Search className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-3 text-base border-0 ring-1 ring-gray-300 dark:ring-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 ease-in-out shadow-sm"
                    placeholder="Search patients by name, ID, gender..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    aria-label="Search patients"
                  />
                </div>
                
                <div className="relative" ref={filterButtonRef}>
                  <motion.button
                    onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-gray-800 border-0 ring-1 ${hasActiveFilters() ? 'ring-indigo-500 text-indigo-600 dark:text-indigo-400' : 'ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-300'} hover:ring-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 ease-in-out shadow-sm`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    aria-expanded={filterDropdownOpen}
                    aria-controls="filter-dropdown"
                  >
                    <Icons.Filter className="h-5 w-5" />
                    <span>Filters</span>
                    {hasActiveFilters() && (
                      <span className="flex items-center justify-center w-5 h-5 ml-1 text-xs font-medium text-white bg-indigo-500 rounded-full">
                        {Object.values(activeFilters).filter(v => v !== '').length}
                      </span>
                    )}
                  </motion.button>
                  
                  <FilterDropdown 
                    isOpen={filterDropdownOpen}
                    onClose={() => setFilterDropdownOpen(false)}
                    filters={activeFilters}
                    onApplyFilters={handleApplyFilters}
                    availableGenders={availableGenders}
                    availableBloodGroups={availableBloodGroups}
                  />
                </div>
              </motion.div>
            </div>
            
            {/* Active filters display */}
            {hasActiveFilters() && (
              <motion.div 
                className="mb-4 flex flex-wrap items-center bg-white dark:bg-gray-800 rounded-2xl p-3 shadow-md border border-gray-100 dark:border-gray-700"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-sm text-gray-600 dark:text-gray-400 mr-2 mb-2 flex items-center">
                  <Icons.Filter className="w-4 h-4 mr-1.5" />
                  Active filters:
                </span>
                
                <AnimatePresence>
                  {activeFilters.gender && (
                    <FilterBadge 
                      key="gender" 
                      label="Gender" 
                      value={activeFilters.gender} 
                      onRemove={() => handleRemoveFilter('gender')} 
                    />
                  )}
                  
                  {activeFilters.bloodGroup && (
                    <FilterBadge 
                      key="bloodGroup" 
                      label="Blood Group" 
                      value={activeFilters.bloodGroup} 
                      onRemove={() => handleRemoveFilter('bloodGroup')} 
                    />
                  )}
                  
                  {activeFilters.minAge && (
                    <FilterBadge 
                      key="minAge" 
                      label="Min Age" 
                      value={activeFilters.minAge} 
                      onRemove={() => handleRemoveFilter('minAge')} 
                    />
                  )}
                  
                  {activeFilters.maxAge && (
                    <FilterBadge 
                      key="maxAge" 
                      label="Max Age" 
                      value={activeFilters.maxAge} 
                      onRemove={() => handleRemoveFilter('maxAge')} 
                    />
                  )}
                </AnimatePresence>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClearAllFilters}
                  className="inline-flex items-center px-3 py-1 ml-2 mb-2 rounded-full text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200 border border-red-100 dark:border-red-900/30"
                >
                  <Icons.ClearFilter className="h-4 w-4 mr-1" />
                  Clear all
                </motion.button>
              </motion.div>
            )}
            
            {/* Main table/content */}
            <div>
              {loading ? (
                <SkeletonLoader />
              ) : error ? (
                <ErrorState message={error} onRetry={handleRetry} />
              ) : showEmptyState ? (
                <EmptySearchResults searchTerm={debouncedSearchTerm} />
              ) : (
                <motion.div 
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="bg-white dark:bg-gray-800 overflow-hidden rounded-3xl shadow-xl hover:shadow-2xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700"
                >
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          {tableHeaders.map(header => (
                            header.sortKey ? (
                              <TableHeader 
                                key={header.id}
                                label={header.label}
                                sortKey={header.sortKey}
                                currentSort={sort}
                                onSort={handleSort}
                              />
                            ) : (
                              <th 
                                key={header.id}
                                scope="col" 
                                className="px-6 py-5 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300"
                              >
                                {header.label}
                              </th>
                            )
                          ))}
                        </tr>
                      </thead>
                      <motion.tbody 
                        className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700"
                        variants={container}
                        initial="hidden"
                        animate="show"
                      >
                        {getCurrentPagePatients().map(patient => (
                          <PatientRow
                            key={patient.id}
                            patient={patient}
                            onView={handleViewPatient}
                            searchTerm={debouncedSearchTerm}
                          />
                        ))}
                      </motion.tbody>
                    </table>
                  </div>
                  
                  {filteredPatients.length > 0 && (
                    <Pagination 
                      pagination={pagination} 
                      onPageChange={handlePageChange} 
                    />
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

// Initialize dark mode listener outside of component
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

// Export PatientRecords component directly
export default PatientRecords;
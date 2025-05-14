/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Add this line
  theme: {
    extend: {
      colors: {
        primary: '#1a73e8',
        secondary: '#5f6368',
        background: '#f8f9fa',
        surface: '#ffffff',
        error: '#d93025',
        success: '#1e8e3e',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      spacing: {
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      boxShadow: {
        'custom': '0 2px 4px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}
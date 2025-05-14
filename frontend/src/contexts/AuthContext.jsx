import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // Service configurations
    const services = {
        auth: {
            baseURL: import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:8022',
            endpoints: {
                login: '/auth/login',
                profile: '/users/me',
                refresh: '/auth/refresh',
                logout: '/auth/logout'
            }
        },
        cardroom: {
            baseURL: import.meta.env.VITE_CARDROOM_SERVICE_URL || 'http://localhost:8023',
            endpoints: {
                patients: '/patients'
            }
        }
    };

    // Create authenticated axios clients
// Update createAxiosClient function
const createAxiosClient = (baseURL) => {
  const client = axios.create({ baseURL });
  
  client.interceptors.request.use(config => {
      const token = localStorage.getItem('accessToken');
      if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          // Add service-specific headers
          config.headers['X-Service-Request'] = 'cardroom-service';
      }
      return config;
  });

  // Add response interceptor
  client.interceptors.response.use(
      response => response,
      async error => {
          if (error.response?.status === 403) {
              // Handle forbidden errors
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
          }
          return Promise.reject(error);
      }
  );
  
  return client;
};

    const authClient = createAxiosClient(services.auth.baseURL);
    const cardroomClient = createAxiosClient(services.cardroom.baseURL);

    const refreshAccessToken = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            const response = await authClient.post(services.auth.endpoints.refresh, {
                refresh_token: refreshToken
            });
            
            const { access_token, refresh_token } = response.data;
            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('refreshToken', refresh_token);
            
            return access_token;
        } catch (error) {
            throw new Error('Session expired. Please login again.');
        }
    };

    // Enhanced login function
    const login = async (username, password) => {
      try {
        const response = await authClient.post(
          services.auth.endpoints.login,
          { username, password },
          { timeout: 5000 }
        );
    
        const { access_token, refresh_token, role } = response.data;
        
        // Store tokens
        localStorage.setItem('accessToken', access_token);
        localStorage.setItem('refreshToken', refresh_token);
    
        // Fetch profile and handle response
        const profileResponse = await authClient.get(
          services.auth.endpoints.profile,
          { timeout: 3000 }
        );
        
        if (!profileResponse.data?.id) {
          throw new Error('Invalid profile response');
        }
    
        setUser(profileResponse.data);
        setIsAuthenticated(true);
        navigate(`/dashboard/${role}`);
        
        return profileResponse.data;
    
      } catch (error) {
        console.error('Login error:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        throw new Error(error.response?.data?.detail || 'Login failed');
      }
    };

    const logout = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                await authClient.post(services.auth.endpoints.logout, { refresh_token: refreshToken });
            }
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
            setIsAuthenticated(false);
            navigate('/login');
        }
    };

    // Initial auth check
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('accessToken');
            if (token) {
                try {
                    const profile = await authClient.get(services.auth.endpoints.profile);
                    setUser(profile.data);
                    setIsAuthenticated(true);
                } catch (error) {
                    if (error.response?.status === 401) {
                        try {
                            await refreshAccessToken();
                            const profile = await authClient.get(services.auth.endpoints.profile);
                            setUser(profile.data);
                            setIsAuthenticated(true);
                        } catch (refreshError) {
                            logout();
                        }
                    }
                }
            }
            setIsLoading(false);
        };

        checkAuth();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                isLoading,
                login,
                logout,
                authClient,
                cardroomClient
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
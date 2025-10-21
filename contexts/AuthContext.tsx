import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Cross-platform API configuration with secure production domain
const API_BASE_URL = 'https://api.garditech.com/api';

interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  createdAt: string;
  familyId?: number;
  imei?: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
  authToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing auth on app start - mobile session restoration
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('@gardi_auth_token');
      const userData = await AsyncStorage.getItem('@gardi_user_data');
      
      if (token && userData) {
        setAuthToken(token);
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
        console.log('✅ Mobile session restored from secure domain');
      }
    } catch (error) {
      console.log('❌ Mobile auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('📱 Attempting secure domain authentication...');
      console.log('🔗 Secure API endpoint:', `${API_BASE_URL}/auth/login`);
      console.log('🌍 Platform:', Platform.OS);
      console.log('📊 Environment:', __DEV__ ? 'Development (using secure production domain)' : 'Production');
      
      // Mobile-first validation
      if (!email?.trim() || !password?.trim()) {
        return { 
          success: false, 
          error: 'Please enter both email and password.' 
        };
      }

      // Secure production domain authentication request
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(), 
          password: password 
        }),
      });

      console.log('📱 Secure domain response status:', response.status);

      // Enhanced mobile error handling for secure domain responses
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.log('❌ Secure domain returned non-JSON response:', textResponse);
        
        if (textResponse.includes('Cannot GET') || textResponse.includes('Cannot POST')) {
          return { 
            success: false, 
            error: 'API server not responding. Please contact support.'
          };
        }
        
        return { 
          success: false, 
          error: 'Server configuration error. Please contact support.' 
        };
      }

      const data = await response.json();
      console.log('📱 Login response received:', data);

      if (response.ok) {
        /**
         * Backend now returns:
         * {
         *   "userId": 36383,
         *   "familyId": 56028,
         *   "imei": "865509052362369",
         *   "jwt": "eyJhbGc..."
         * }
         */
        
        const token = data.jwt || data.authToken;
        
        if (!token) {
          console.log('❌ No JWT token in response');
          return { 
            success: false, 
            error: 'Server did not return authentication token.' 
          };
        }

        // Construct user data from response and JWT payload
        let userData = null;
        
        try {
          // Decode JWT to get additional user info
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const base64Payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
            const paddedPayload = base64Payload.padEnd(
              base64Payload.length + (4 - (base64Payload.length % 4)) % 4,
              '='
            );
            const decodedPayload = JSON.parse(atob(paddedPayload));
            
            console.log('🔓 Decoded JWT payload:', decodedPayload);
            
            // Build user object from response and JWT
            userData = {
              userId: String(data.userId || decodedPayload.userId),
              email: email, // Use the email they logged in with
              role: decodedPayload.surfsightRole || decodedPayload.role || 'user',
              firstName: data.firstName || decodedPayload.firstName || '',
              lastName: data.lastName || decodedPayload.lastName || '',
              username: data.username || decodedPayload.username || email,
              createdAt: data.createdAt || decodedPayload.createdAt || new Date().toISOString(),
              familyId: data.familyId || decodedPayload.familyId,
              imei: data.imei || null
            };
            
            console.log('✅ User data constructed:', userData);
          }
        } catch (error) {
          console.log('❌ Failed to decode JWT token:', error);
          return { 
            success: false, 
            error: 'Invalid token format received from server.' 
          };
        }
        
        if (token && userData) {
          // Validate required user fields for mobile app
          if (!userData.userId || !userData.email) {
            console.log('❌ Invalid user data:', userData);
            return { 
              success: false, 
              error: 'Invalid user data received from server.' 
            };
          }
          
          // Store authentication data
          await AsyncStorage.setItem('@gardi_auth_token', token);
          await AsyncStorage.setItem('@gardi_user_data', JSON.stringify(userData));
          
          setAuthToken(token);
          setUser(userData);
          setIsAuthenticated(true);
          
          console.log('✅ Authentication successful:', userData.email);
          console.log('📱 User ID:', userData.userId);
          console.log('📱 Family ID:', userData.familyId);
          console.log('📱 IMEI:', userData.imei);
          
          return { success: true };
        } else {
          console.log('❌ Missing token or user data');
          return { 
            success: false, 
            error: 'Server did not return complete authentication data. Please contact support.' 
          };
        }
        
      } else {
        // Handle secure domain authentication errors
        let errorMessage = 'Authentication failed.';
        
        if (response.status === 401) {
          errorMessage = 'Invalid email or password.';
        } else if (response.status === 400) {
          if (data.error) {
            errorMessage = data.error;
          } else if (data.details && Array.isArray(data.details)) {
            // Handle validation errors from secure domain
            errorMessage = data.details.map((detail: any) => 
              detail.message || detail
            ).join(', ');
          } else {
            errorMessage = 'Invalid login credentials format.';
          }
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (data.error) {
          errorMessage = data.error;
        }
        
        console.log('❌ Secure domain authentication failed:', response.status, errorMessage);
        return { success: false, error: errorMessage };
      }
      
    } catch (error) {
      console.log('❌ Network error during secure domain authentication:', error);
      
      // Cross-platform network error handling for secure domain
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        return { 
          success: false, 
          error: 'Cannot connect to api.garditech.com. Please check your internet connection.'
        };
      }
      
      return { 
        success: false, 
        error: 'Network error occurred. Please check your connection and try again.' 
      };
    }
  };

  const logout = async () => {
    try {
      console.log('🔄 Mobile logout - clearing secure domain session...');
      
      // Notify secure domain of logout
      if (authToken) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          });
          console.log('✅ Secure domain logout notification sent');
        } catch (error) {
          console.log('⚠️ Secure domain logout notification failed (non-critical):', error);
        }
      }

      // Clear mobile secure storage
      await AsyncStorage.multiRemove(['@gardi_auth_token', '@gardi_user_data']);
      
      // Reset mobile authentication state
      setAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
      
      console.log('✅ Mobile user logged out successfully from secure domain');
    } catch (error) {
      console.log('❌ Mobile logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      login, 
      logout, 
      loading, 
      authToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
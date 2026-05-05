'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Auth Token Payload
 * Supports all user types: COMMUNITY_USER (mothers), CHW, DOCTOR, NURSE, MIDWIFE, SYSTEM_ADMIN, HOSPITAL_ADMIN, etc.
 */
interface AuthPayload {
  userId?: number;
  motherId?: number; // Legacy: for backward compatibility with mothers
  username: string;
  phone: string;
  email?: string;
  role: string; // 'COMMUNITY_USER' | 'CHW' | 'DOCTOR' | 'MIDWIFE' | 'NURSE' | 'SYSTEM_ADMIN' | 'HOSPITAL_ADMIN' | etc.
  iat?: number;
  exp?: number;
}

/**
 * useAuth Hook
 * Manages authentication state and JWT token for all user types (mothers, CHWs, Healthcare Workers, Admins)
 * 
 * Stores in localStorage:
 * - token: JWT token
 * - userId: User ID
 * - motherId: Mother ID (for backward compatibility, if applicable)
 * - username: Username
 * - email: Email address
 * - phone: Phone number
 * - role: User role
 * 
 * Usage:
 * const { 
 *   isAuthenticated, userId, motherId, token, username, email, phone, role,
 *   login, logout, isLoading, getAuthHeader 
 * } = useAuth();
 * 
 * // Login after sign-in:
 * login(token, userId, username, email, phone, role, motherId)
 */
export function useAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [motherId, setMotherId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // ========================================================================
  // INITIALIZE FROM LOCALSTORAGE
  // ========================================================================
  useEffect(() => {
    // Mark component as mounted to avoid hydration issues
    setMounted(true);

    const initializeAuth = () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUserId = localStorage.getItem('userId');
        const storedMotherId = localStorage.getItem('motherId');
        const storedUsername = localStorage.getItem('username');
        const storedEmail = localStorage.getItem('email');
        const storedPhone = localStorage.getItem('phone');
        const storedRole = localStorage.getItem('role');

        if (storedToken) {
          // Must have at least token and either userId or motherId
          const hasUserId = storedUserId && storedUserId !== '0';
          const hasMotherId = storedMotherId && parseInt(storedMotherId, 10) > 0;
          
          if (hasUserId || hasMotherId) {
            setToken(storedToken);
            if (hasUserId) {
              setUserId(parseInt(storedUserId, 10));
            }
            if (hasMotherId) {
              setMotherId(parseInt(storedMotherId, 10));
            }
            setUsername(storedUsername);
            setEmail(storedEmail);
            setPhone(storedPhone);
            setRole(storedRole);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ========================================================================
  // LOGIN - Store token and user details
  // ========================================================================
  const login = useCallback(
    async (
      token: string,
      userId: number,
      username: string,
      email: string | null,
      phone: string | null,
      role: string,
      motherId?: number // Optional for backward compatibility
    ) => {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('userId', String(userId));
        localStorage.setItem('username', username);
        localStorage.setItem('role', role);

        if (email) {
          localStorage.setItem('email', email);
        } else {
          localStorage.removeItem('email');
        }

        if (phone) {
          localStorage.setItem('phone', phone);
        } else {
          localStorage.removeItem('phone');
        }

        if (motherId) {
          localStorage.setItem('motherId', String(motherId));
        } else {
          localStorage.removeItem('motherId');
        }

        // Update state in sequence to ensure proper synchronization
        setToken(token);
        setUserId(userId);
        setUsername(username);
        setEmail(email);
        setPhone(phone);
        setRole(role);
        if (motherId) {
          setMotherId(motherId);
        }
        
        // Set authenticated state last to trigger redirect effect
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error storing auth token:', error);
        throw error;
      }
    },
    []
  );

  // ========================================================================
  // LOGOUT - Clear token and all auth data, redirect to home
  // ========================================================================
  const logout = useCallback(() => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('motherId');
      localStorage.removeItem('username');
      localStorage.removeItem('email');
      localStorage.removeItem('phone');
      localStorage.removeItem('role');

      setToken(null);
      setUserId(null);
      setMotherId(null);
      setUsername(null);
      setEmail(null);
      setPhone(null);
      setRole(null);
      setIsAuthenticated(false);
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, [router]);

  // ========================================================================
  // VERIFY TOKEN FROM COOKIE
  // ========================================================================
  const verifyTokenFromCookie = useCallback(async (): Promise<{
    success: boolean;
    payload?: {
      userId?: number;
      motherId?: number;
      username: string;
      phone: string;
      email?: string;
      role: string;
      iat?: number;
      exp?: number;
    };
    error?: string;
  }> => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include', // Important: include cookies
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to verify token',
        };
      }

      return data;
    } catch (error) {
      console.error('Error verifying token from cookie:', error);
      return {
        success: false,
        error: 'Network error',
      };
    }
  }, []);

  // ========================================================================
  // GET AUTHORIZATION HEADER
  // ========================================================================
  const getAuthHeader = useCallback(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  return {
    token,
    userId,
    motherId,
    username,
    email,
    phone,
    role,
    isAuthenticated,
    isLoading,
    login,
    logout,
    getAuthHeader,
    verifyTokenFromCookie,
  };
}

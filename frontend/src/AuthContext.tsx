import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import api from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'admin';
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  securityLogout: (reason: string) => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState<boolean>(() => {
    const hasToken = !!localStorage.getItem('access_token');
    const hasUser = !!localStorage.getItem('cached_user');
    return hasToken && !hasUser;
  });

  useEffect(() => {
    if (token) {
      // Validate session in background or restore user data
      api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(response => {
          setUser(response.data);
          try {
            localStorage.setItem('cached_user', JSON.stringify(response.data));
          } catch {
            // ignore
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const handleSecurityLogout = (event: Event) => {
      const customEvent = event as CustomEvent;
      const reason = customEvent.detail?.reason || 'Session expired';
      sessionStorage.setItem('logout_reason', reason);
      logout();
    };

    window.addEventListener('auth:logout', handleSecurityLogout);
    return () => window.removeEventListener('auth:logout', handleSecurityLogout);
  }, [token]);

  const login = (newToken: string, userData: User) => {
    sessionStorage.removeItem('manual_logout');
    sessionStorage.removeItem('logout_reason');
    localStorage.setItem('access_token', newToken);
    try {
      localStorage.setItem('cached_user', JSON.stringify(userData));
    } catch {
      // ignore
    }
    setToken(newToken);
    setUser(userData);
    setLoading(false);
  };

  const logout = async () => {
    sessionStorage.setItem('manual_logout', 'true');
    sessionStorage.removeItem('logout_reason');
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch {
      // Ignore background errors on logout
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('cached_user');
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      // Keep manual_logout active for 8 seconds to swallow any straggling 401s
      setTimeout(() => {
        sessionStorage.removeItem('manual_logout');
      }, 8000);
    }
  };

  const securityLogout = (reason: string) => {
    sessionStorage.setItem('logout_reason', reason);
    logout();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, securityLogout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
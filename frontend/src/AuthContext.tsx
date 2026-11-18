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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && !user) {
      // Explicitly attaching the token guarantees it bypasses any interceptor bugs
      api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(response => setUser(response.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else if (!token) {
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
  }, [token, user]);

  const login = (newToken: string, userData: User) => {
    sessionStorage.removeItem('manual_logout');
    sessionStorage.removeItem('logout_reason');
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
    setUser(userData);
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
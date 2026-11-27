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
  updateUser: (userData: User) => void;
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
    return hasToken || !hasUser;
  });

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      if (token) {
        try {
          const response = await api.get('/auth/me', { skipCache: true } as any);
          if (!active) return;
          setUser(response.data);
          localStorage.setItem('cached_user', JSON.stringify(response.data));
        } catch {
          if (!active) return;
          localStorage.removeItem('access_token');
          localStorage.removeItem('cached_user');
          setToken(null);
          setUser(null);
        } finally {
          if (active) setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    restoreSession();

    const handleSecurityLogout = (event: Event) => {
      const customEvent = event as CustomEvent;
      const reason = customEvent.detail?.reason || 'Session expired';
      sessionStorage.setItem('logout_reason', reason);
      logout();
    };

    window.addEventListener('auth:logout', handleSecurityLogout);
    return () => {
      active = false;
      window.removeEventListener('auth:logout', handleSecurityLogout);
    };
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

  const updateUser = (userData: User) => {
    setUser(userData);
    try {
      localStorage.setItem('cached_user', JSON.stringify(userData));
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, securityLogout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
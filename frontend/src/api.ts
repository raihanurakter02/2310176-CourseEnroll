import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000';
  }
  return 'https://two310176-courseenroll.onrender.com';
};

export const getWsUrl = () => {
  const baseUrl = getBaseUrl();
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://') + '/ws/notifications';
  }
  return baseUrl.replace('http://', 'ws://') + '/ws/notifications';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// This intercepts EVERY request and securely attaches your login token
api.interceptors.request.use((config) => {
  // We check both common keys just in case your AuthContext uses a different one
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail || '';
    const requestUrl = error.config?.url || '';

    // If logging out or already logged out manually, silence 401
    const isManual = sessionStorage.getItem('manual_logout') === 'true';

    if (requestUrl.includes('/auth/logout')) {
      return Promise.resolve({ data: { message: 'Logged out' } });
    }

    if (status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      if (!isManual && (detail.toLowerCase().includes('revoked') || detail.toLowerCase().includes('suspended') || detail.toLowerCase().includes('locked'))) {
        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { reason: detail }
        }));
      }
    } else if (status === 403 && (detail.toLowerCase().includes('suspended') || detail.toLowerCase().includes('banned'))) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      if (!isManual) {
        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { reason: detail }
        }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
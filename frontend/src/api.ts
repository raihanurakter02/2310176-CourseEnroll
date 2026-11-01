import axios from 'axios';

const api = axios.create({
  baseURL: 'https://two310176-courseenroll.onrender.com', 
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

export default api;
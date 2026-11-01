import axios from 'axios';

const api = axios.create({
  // Replace the old http://127.0.0.1:8000 or '/api' with your live Render URL
  baseURL: 'https://two310176-courseenroll.onrender.com', 
});

// If you have interceptors for your auth token, leave them exactly as they are below
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
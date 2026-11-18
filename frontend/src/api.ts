import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

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

// ---------------------------------------------------------------------------
// LIGHTNING CACHE ENGINE (Stale-While-Revalidate + Memory & SessionStorage)
// ---------------------------------------------------------------------------
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export const getCachedData = <T = any>(url: string): T | null => {
  const now = Date.now();
  const mem = memoryCache.get(url);
  if (mem && (now - mem.timestamp < CACHE_TTL_MS)) {
    return mem.data as T;
  }
  try {
    const raw = sessionStorage.getItem(`ce_cache_${url}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (now - parsed.timestamp < CACHE_TTL_MS)) {
        memoryCache.set(url, parsed);
        return parsed.data as T;
      }
    }
  } catch {
    // sessionStorage unavailable or parsing error
  }
  return null;
};

export const setCachedData = (url: string, data: any) => {
  const item = { data, timestamp: Date.now() };
  memoryCache.set(url, item);
  try {
    sessionStorage.setItem(`ce_cache_${url}`, JSON.stringify(item));
  } catch {
    // Quota exceeded or private browsing mode
  }
};

export const invalidateApiCache = (pattern?: string) => {
  if (!pattern) {
    memoryCache.clear();
    try {
      const keys = Object.keys(sessionStorage);
      for (const k of keys) {
        if (k.startsWith('ce_cache_')) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}
    return;
  }

  for (const k of memoryCache.keys()) {
    if (k.includes(pattern)) {
      memoryCache.delete(k);
    }
  }
  try {
    const keys = Object.keys(sessionStorage);
    for (const k of keys) {
      if (k.startsWith('ce_cache_') && k.includes(pattern)) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
};

// Global event listeners to invalidate cache on state mutation
if (typeof window !== 'undefined') {
  window.addEventListener('enrollments:refresh', () => {
    invalidateApiCache('/enrollments');
    invalidateApiCache('/courses');
  });
  window.addEventListener('announcements:refresh', () => {
    invalidateApiCache('/announcements');
  });
  window.addEventListener('auth:logout', () => {
    invalidateApiCache();
  });
}

// ---------------------------------------------------------------------------
// AXIOS INTERCEPTORS
// ---------------------------------------------------------------------------
api.interceptors.request.use((config) => {
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
      invalidateApiCache();
      if (!isManual && (detail.toLowerCase().includes('revoked') || detail.toLowerCase().includes('suspended') || detail.toLowerCase().includes('locked'))) {
        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { reason: detail }
        }));
      }
    } else if (status === 403 && (detail.toLowerCase().includes('suspended') || detail.toLowerCase().includes('banned'))) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      invalidateApiCache();
      if (!isManual) {
        window.dispatchEvent(new CustomEvent('auth:logout', {
          detail: { reason: detail }
        }));
      }
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// STALE-WHILE-REVALIDATE HOOKS INTO API METHODS
// ---------------------------------------------------------------------------
const originalGet = api.get.bind(api);
const originalPost = api.post.bind(api);
const originalPut = api.put.bind(api);
const originalDelete = api.delete.bind(api);
const originalPatch = api.patch.bind(api);

api.get = function<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D> & { skipCache?: boolean }): Promise<R> {
  const skipCache = config?.skipCache;
  if (!skipCache) {
    const cached = getCachedData<T>(url);
    if (cached !== null) {
      // Revalidate in background if cache is older than 4 seconds
      const mem = memoryCache.get(url);
      if (!mem || Date.now() - mem.timestamp > 4000) {
        originalGet<T, R, D>(url, { ...config, skipCache: true } as any)
          .then((res: any) => {
            if (res && res.data !== undefined) {
              setCachedData(url, res.data);
              window.dispatchEvent(new CustomEvent('api:cache-updated', { detail: { url, data: res.data } }));
            }
          })
          .catch(() => {});
      }

      return Promise.resolve({
        data: cached,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config || {},
      } as unknown as R);
    }
  }

  return originalGet<T, R, D>(url, config).then((res: any) => {
    if (res && res.data !== undefined && !skipCache) {
      setCachedData(url, res.data);
    }
    return res;
  });
} as any;

api.post = function(...args: any[]) {
  invalidateApiCache();
  return originalPost.apply(api, args as any);
} as any;

api.put = function(...args: any[]) {
  invalidateApiCache();
  return originalPut.apply(api, args as any);
} as any;

api.delete = function(...args: any[]) {
  invalidateApiCache();
  return originalDelete.apply(api, args as any);
} as any;

api.patch = function(...args: any[]) {
  invalidateApiCache();
  return originalPatch.apply(api, args as any);
} as any;

export default api;

import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_GATEWAY_URL ||
  'http://localhost:4000';

// Public client — no auth headers. Uses Bearer token architecture without cookies.
export const publicApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

// Authenticated client — attaches Clerk JWT via Authorization header.
export const authApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

authApi.interceptors.request.use(async (config) => {
  try {
    const token =
      (typeof window !== 'undefined' && window.__devToken) ||
      (await window.__getClerkToken?.());
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Clerk not ready; proceed without token
  }
  return config;
});

authApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

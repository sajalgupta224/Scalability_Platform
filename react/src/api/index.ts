import axios, { AxiosError, type AxiosInstance } from 'axios';
import { transformAxiosError, handleErrorNotification } from './errorHandler';
import type { ExtendedAxiosRequestConfig } from '../types/api.types';

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.example.com';
const isLocal = import.meta.env.MODE === 'development';
const API_BASE_URL = isLocal
  ? import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
  : '/api';

const headers = {
  "Content-Type": "application/json",
  "Accept": "application/json"
};

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // timeout: 30000,
  headers
});

// 🔒 Request interceptor
api.interceptors.request.use(
  (config) => {
    // TODO : Add authorization token if available
    // const token = localStorage.getItem('accessToken');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// ⚠️ Response interceptor with enhanced error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Extract error config from request
    const errorConfig = (error.config as ExtendedAxiosRequestConfig)?.errorConfig;

    // Transform axios error to enhanced API error
    const enhancedError = transformAxiosError(error);

    // Handle special cases
    if (enhancedError.status === 401) {
      // Authentication error - handle logout/redirect
      console.warn('Unauthorized! Redirecting to login...');
      // TODO: Implement logout logic
      // window.location.href = '/login';
    }

    // Show notification (unless disabled)
    handleErrorNotification(enhancedError, errorConfig);

    // Log error for debugging (in development)
    if (import.meta.env.MODE === 'development') {
      console.error('API Error:', {
        message: enhancedError.message,
        status: enhancedError.status,
        code: enhancedError.code,
        data: enhancedError.data,
        url: error.config?.url,
      });
    }

    // Reject with enhanced error
    return Promise.reject(enhancedError);
  }
);

export default api;

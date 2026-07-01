import api from './index';
import type {
  ApiResponse,
  ApiResponseWithStatus,
  ExtendedAxiosRequestConfig,
} from '../types/api.types';
import {
  EnhancedApiError,
  transformApiResponseError,
  handleErrorNotification,
} from './errorHandler';
import type { AxiosResponse } from 'axios';

/**
 * Safely extract backend response whether it's:
 * 1) Wrapped: { success, data }
 * 2) Plain JSON: { users: [...] } or { access: [...] }
 */
function extractResponse<T>(
  payload: any,
  config?: ExtendedAxiosRequestConfig,
  status?: AxiosResponse['status']
): T {
  // Backend is plain JSON (RBAC)
  if (!payload || typeof payload !== 'object' || !('success' in payload)) {
    return payload as T;
  }

  // Backend uses wrapped API
  const wrapped = payload as ApiResponse<T>;
  if (!wrapped.success) {
    const responseWithStatus: ApiResponseWithStatus<T> = { ...wrapped, status };
    const enhanced = transformApiResponseError(responseWithStatus);
    handleErrorNotification(enhanced, config?.errorConfig);
    throw enhanced;
  }

  return wrapped.data;
}

export const apiClient = {
  async get<T>(url: string, config?: ExtendedAxiosRequestConfig): Promise<T> {
    const res = await api.get(url, config);
    return extractResponse<T>(res.data, config, res.status);
  },

  async post<T, D = unknown>(
    url: string,
    body?: D,
    config?: ExtendedAxiosRequestConfig
  ): Promise<T> {
    const res = await api.post(url, body, config);
    return extractResponse<T>(res.data, config, res.status);
  },

  async put<T, D = unknown>(
    url: string,
    body?: D,
    config?: ExtendedAxiosRequestConfig
  ): Promise<T> {
    const res = await api.put(url, body, config);
    return extractResponse<T>(res.data, config, res.status);
  },

  async delete<T>(url: string, config?: ExtendedAxiosRequestConfig): Promise<T> {
    const res = await api.delete(url, config);
    return extractResponse<T>(res.data, config, res.status);
  },
};

export { EnhancedApiError as ApiError };
``
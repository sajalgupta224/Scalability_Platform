import type { AxiosRequestConfig } from 'axios';

/**
 * API Response and Error Types
 * Consolidated from multiple locations to avoid duplication
 */

/**
 * Generic Axios API response wrapper
 * Used in ApiClient for consistent API response handling
 */
export interface AxiosApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Generic API response wrapper
 * Used across the application for consistent API response handling
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

/**
 * API response with HTTP status code
 * Used when passing response data along with status to error handlers
 */
export interface ApiResponseWithStatus<T> extends ApiResponse<T> {
  status?: number;
}

/**
 * Error category for message mapping
 */
export const ErrorCategory = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

/**
 * Enhanced API Error interface with additional metadata
 */
export interface ApiError {
  name: 'ApiError';
  message: string;
  code?: string | number;
  status?: number;
  data?: unknown;
  isNetworkError?: boolean;
  isTimeout?: boolean;
  isServerError?: boolean;
  isClientError?: boolean;
  originalError?: unknown;
}

/**
 * Configuration for API error handling behavior
 */
export interface ApiErrorConfig {
  /**
   * Disable automatic notification for this request
   */
  skipNotification?: boolean;

  /**
   * Custom error message override
   */
  customErrorMessage?: string;

  /**
   * Callback for custom error handling
   */
  onError?: (error: ApiError) => void;

  /**
   * Retry configuration (for future enhancement)
   */
  retry?: {
    maxAttempts?: number;
    retryableStatuses?: number[];
  };
}

/**
 * Extended Axios config to include our error config
 */
export interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  errorConfig?: ApiErrorConfig;
}
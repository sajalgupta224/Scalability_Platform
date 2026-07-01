import axios, { AxiosError } from 'axios';
import type { ApiError, ApiErrorConfig, ApiResponseWithStatus } from '../types/api.types';
import { categorizeError, getErrorMessage } from './errorMessages';
import { notificationService } from './notificationService';

/**
 * Enhanced ApiError class
 */
export class EnhancedApiError extends Error implements ApiError {
  public override name = 'ApiError' as const;
  public code?: string | number;
  public status?: number;
  public data?: unknown;
  public isNetworkError?: boolean;
  public isTimeout?: boolean;
  public isServerError?: boolean;
  public isClientError?: boolean;
  public originalError?: unknown;

  constructor(params: {
    message: string;
    code?: string | number;
    status?: number;
    data?: unknown;
    isNetworkError?: boolean;
    isTimeout?: boolean;
    originalError?: unknown;
  }) {
    super(params.message);
    Object.assign(this, params);

    if (params.status) {
      this.isServerError = params.status >= 500;
      this.isClientError = params.status >= 400 && params.status < 500;
    }
  }
}

/**
 * Transforms AxiosError into EnhancedApiError with user-friendly message
 */
export function transformAxiosError(error: AxiosError): EnhancedApiError {
  // Check if request was cancelled
  if (axios.isCancel(error)) {
    return new EnhancedApiError({
      message: 'Request cancelled',
      code: 'CANCELLED',
      originalError: error,
    });
  }

  // Extract relevant information
  const status = error.response?.status;
  const code = error.code;
  const isNetworkError = !error.response && !!error.request;
  const isTimeout = code === 'ECONNABORTED' || code === 'ETIMEDOUT';

  // Try to get server error message from response
  const responseData = error.response?.data as Record<string, unknown> | undefined;
  const serverMessage = (responseData?.message || responseData?.error) as string | undefined;

  // Categorize error and get appropriate message
  const category = categorizeError(status, code, isNetworkError);
  const userMessage = getErrorMessage(category, status, code, serverMessage);

  // Create enhanced error
  return new EnhancedApiError({
    message: userMessage,
    code,
    status,
    data: responseData,
    isNetworkError,
    isTimeout,
    originalError: error,
  });
}

/**
 * Handles API response errors (when success: false in ApiResponse)
 */
export function transformApiResponseError<T>(response: ApiResponseWithStatus<T>): EnhancedApiError {
  const message = response.message || 'An error occurred';
  const code = response.error;
  const status = response.status;

  // Get user-friendly message
  const category = categorizeError(status, code);
  const userMessage = getErrorMessage(category, status, code, message);

  return new EnhancedApiError({
    message: userMessage,
    code,
    status,
    data: response.data,
  });
}

/**
 * Shows error notification unless disabled in config
 */
export function handleErrorNotification(error: EnhancedApiError, config?: ApiErrorConfig) {
  // Skip notification for cancelled requests
  if (error.code === 'CANCELLED') {
    return;
  }

  // Check if notification should be skipped
  if (config?.skipNotification) {
    return;
  }

  // Use custom message if provided
  const message = config?.customErrorMessage || error.message;

  // Show notification
  notificationService.showError(message);

  // Call custom error handler if provided
  if (config?.onError) {
    config.onError(error);
  }
}

/**
 * Determines if an error is retryable (for future enhancement)
 */
export function isRetryableError(error: EnhancedApiError, config?: ApiErrorConfig): boolean {
  if (!config?.retry) {
    return false;
  }

  const retryableStatuses = config.retry.retryableStatuses || [408, 429, 500, 502, 503, 504];

  // Network errors and timeouts are retryable
  if (error.isNetworkError || error.isTimeout) {
    return true;
  }

  // Check if status is in retryable list
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  return false;
}

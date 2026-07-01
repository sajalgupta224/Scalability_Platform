import { ErrorCategory } from '../types/api.types';

/**
 * User-friendly error messages mapped by category and status code
 */
export const ERROR_MESSAGES: Record<ErrorCategory, Record<string | number, string>> = {
  [ErrorCategory.NETWORK]: {
    default:
      'Unable to connect to the server. Please check your internet connection and try again.',
    ERR_NETWORK: 'Network connection failed. Please check your internet connection.',
    ERR_CONNECTION_REFUSED: 'Could not connect to the server. Please try again later.',
  },

  [ErrorCategory.TIMEOUT]: {
    default: 'The request took too long to complete. Please try again.',
    ECONNABORTED: 'Request timeout. The server is taking too long to respond.',
  },

  [ErrorCategory.AUTHENTICATION]: {
    401: 'Your session has expired. Please log in again.',
    default: 'Authentication failed. Please log in again.',
  },

  [ErrorCategory.AUTHORIZATION]: {
    403: 'You do not have permission to perform this action.',
    default: 'Access denied.',
  },

  [ErrorCategory.VALIDATION]: {
    400: 'Invalid request. Please check your input and try again.',
    422: 'The data you provided could not be processed. Please review and try again.',
    default: 'Validation error. Please check your input.',
  },

  [ErrorCategory.NOT_FOUND]: {
    404: 'The requested resource was not found.',
    default: 'Resource not found.',
  },

  [ErrorCategory.SERVER_ERROR]: {
    500: 'An internal server error occurred. Please try again later.',
    502: 'Bad gateway. The server is temporarily unavailable.',
    503: 'Service temporarily unavailable. Please try again later.',
    504: 'Gateway timeout. Please try again later.',
    default: 'A server error occurred. Please try again later.',
  },

  [ErrorCategory.CLIENT_ERROR]: {
    default: 'An error occurred while processing your request.',
  },

  [ErrorCategory.UNKNOWN]: {
    default: 'An unexpected error occurred. Please try again.',
  },
};

/**
 * Categorizes error based on status code and error type
 */
export function categorizeError(
  status?: number,
  code?: string,
  isNetworkError?: boolean
): ErrorCategory {
  if (isNetworkError) {
    return ErrorCategory.NETWORK;
  }

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return ErrorCategory.TIMEOUT;
  }

  if (status === 401) {
    return ErrorCategory.AUTHENTICATION;
  }

  if (status === 403) {
    return ErrorCategory.AUTHORIZATION;
  }

  if (status === 400 || status === 422) {
    return ErrorCategory.VALIDATION;
  }

  if (status === 404) {
    return ErrorCategory.NOT_FOUND;
  }

  if (status && status >= 500) {
    return ErrorCategory.SERVER_ERROR;
  }

  if (status && status >= 400) {
    return ErrorCategory.CLIENT_ERROR;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Gets user-friendly error message based on category, status, and code
 */
export function getErrorMessage(
  category: ErrorCategory,
  status?: number,
  code?: string,
  serverMessage?: string
): string {
  const categoryMessages = ERROR_MESSAGES[category];

  // Prioritize server message for validation errors (often more specific)
  if (category === ErrorCategory.VALIDATION && serverMessage) {
    return serverMessage;
  }

  // Try to get specific message by status code
  if (status && categoryMessages[status]) {
    return categoryMessages[status];
  }

  // Try to get specific message by error code
  if (code && categoryMessages[code]) {
    return categoryMessages[code];
  }

  // Use server message if available and helpful (not too long)
  if (serverMessage && serverMessage.length > 0 && serverMessage.length < 200) {
    return serverMessage;
  }

  // Fall back to default message
  return categoryMessages.default || 'An unexpected error occurred.';
}

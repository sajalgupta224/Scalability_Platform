/**
 * Error Monitoring and Logging Types
 * Consolidated from mockErrorData.ts and ErrorLogTable component
 */

/**
 * Application error statistics for charts
 */
export interface AppErrorStatistic {
  name: string;
  value: number;
  color: string;
}

/**
 * Error trend data by month and event type
 */
export interface ErrorTrendData {
  month: string;
  chatbot: number;
  dataPipeline: number;
  fallback: number;
  fallbackSuccess: number;
  register: number;
  toolFailure: number;
}

/**
 * Error log entry for table display
 */
export interface ErrorLogEntry {
  sno: number;
  date: string;
  eventType: string;
  errorMessage: string;
  email: string;
  context: string;
}

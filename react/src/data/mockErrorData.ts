// Mock data for Error Monitoring page
import type { AppErrorStatistic, ErrorTrendData, ErrorLogEntry } from '../types/errors.types';
import type { DropdownOption } from '../types/ui.types';

// Re-export types for backward compatibility
export type { AppErrorStatistic, ErrorTrendData, ErrorLogEntry, DropdownOption };

// App-wise error statistics (for donut chart)
export const mockAppErrorStats: AppErrorStatistic[] = [
  { name: 'Banking bot', value: 35, color: '#9B59B6' },
  { name: 'Revenue bot', value: 25, color: '#EC407A' },
  { name: 'Finance bot', value: 25, color: '#1E88E5' },
  { name: 'Business bot', value: 15, color: '#FFA726' },
];

// Daily error trends by event type (for stacked bar chart)
export const mockErrorTrendData: ErrorTrendData[] = [
  {
    month: 'Apr',
    chatbot: 12,
    dataPipeline: 3,
    fallback: 0,
    fallbackSuccess: 15,
    register: 0,
    toolFailure: 0,
  },
  {
    month: 'May',
    chatbot: 8,
    dataPipeline: 0,
    fallback: 0,
    fallbackSuccess: 5,
    register: 10,
    toolFailure: 18,
  },
  {
    month: 'Jun',
    chatbot: 0,
    dataPipeline: 0,
    fallback: 0,
    fallbackSuccess: 0,
    register: 0,
    toolFailure: 0,
  },
  {
    month: 'Jul',
    chatbot: 15,
    dataPipeline: 1,
    fallback: 12,
    fallbackSuccess: 4,
    register: 0,
    toolFailure: 0,
  },
  {
    month: 'Aug',
    chatbot: 0,
    dataPipeline: 0,
    fallback: 0,
    fallbackSuccess: 0,
    register: 0,
    toolFailure: 0,
  },
  {
    month: 'Sep',
    chatbot: 12,
    dataPipeline: 0,
    fallback: 3,
    fallbackSuccess: 2,
    register: 0,
    toolFailure: 0,
  },
  {
    month: 'Oct',
    chatbot: 0,
    dataPipeline: 0,
    fallback: 0,
    fallbackSuccess: 0,
    register: 0,
    toolFailure: 0,
  },
  {
    month: 'Nov',
    chatbot: 2,
    dataPipeline: 5,
    fallback: 0,
    fallbackSuccess: 1,
    register: 28,
    toolFailure: 12,
  },
];

// Error log table data
export const mockErrorLogs: ErrorLogEntry[] = [
  {
    sno: 0,
    date: 'DDMMYY',
    eventType: 'Data Pipeline',
    errorMessage: '001240 (42601):SQL Compilation error: Unknown function fixed_Chunking',
    email: 'email',
    context: 'Chunking step',
  },
  {
    sno: 0,
    date: 'DDMMYY',
    eventType: 'Data Pipeline',
    errorMessage: '001240 (42601):SQL Compilation error: Unknown function fixed_Chunking',
    email: 'email',
    context: 'Chunking step',
  },
  {
    sno: 0,
    date: 'DDMMYY',
    eventType: 'Data Pipeline',
    errorMessage: '001240 (42601):SQL Compilation error: Unknown function fixed_Chunking',
    email: 'email',
    context: 'Chunking step',
  },
];

// Event type options for dropdown
export const mockEventTypeOptions: DropdownOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Chatbot experiment', value: 'chatbot' },
  { label: 'Data pipeline', value: 'dataPipeline' },
  { label: 'Fallback', value: 'fallback' },
  { label: 'Fallback Success', value: 'fallbackSuccess' },
  { label: 'Register', value: 'register' },
  { label: 'Tool failure', value: 'toolFailure' },
];

// Date options for dropdown
export const mockDateOptions: DropdownOption[] = [
  { label: 'Last 7 days', value: '7days' },
  { label: 'Last 30 days', value: '30days' },
  { label: 'Last 90 days', value: '90days' },
  { label: 'Last 6 months', value: '6months' },
  { label: 'Last year', value: '1year' },
  { label: 'Custom range', value: 'custom' },
];

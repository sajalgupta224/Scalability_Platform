import React from 'react';

/**
 * Metric data displayed in metric cards
 */
export interface MetricData {
  id: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor?: string;
  value: string | number;
  label: string;
  trend: TrendData;
}

/**
 * Trend information for metrics
 */
export interface TrendData {
  value: number;
  direction: 'up' | 'down';
  isPositive: boolean;
  label: string;
}

/**
 * Alert/notification data
 */
export interface AlertData {
  id: string;
  severity: 'warning' | 'error' | 'info' | 'success';
  message: string;
  timestamp?: Date;
}

/**
 * Generic chart data point
 */
export interface ChartDataPoint {
  [key: string]: string | number;
}

/**
 * CSAT score data point for bar chart
 */
export interface CSATDataPoint {
  date: string;
  score: number;
}

/**
 * User trend data point for area chart
 */
export interface UserTrendDataPoint {
  month: string;
  users: number;
}

/**
 * Token usage data point for line chart
 */
export interface TokenTrendDataPoint {
  month: string;
  tokens: number;
}

// DateRange and DropdownOption moved to ui.types.ts
// Import them from there: import { DateRange, DropdownOption } from './ui.types';
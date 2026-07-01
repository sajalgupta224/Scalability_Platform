import React from 'react';
import type {
  MetricData,
  AlertData,
  CSATDataPoint,
  UserTrendDataPoint,
  TokenTrendDataPoint,
} from '../types/monitoring.types';
import type { DropdownOption } from '../types/ui.types';
import PeopleIcon from '@mui/icons-material/People';
import ChatIcon from '@mui/icons-material/Chat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import DataUsageIcon from '@mui/icons-material/DataUsage';

/**
 * Mock metrics data for the 6 metric cards
 */
export const mockMetrics: MetricData[] = [
  {
    id: 'total-users',
    icon: React.createElement(PeopleIcon),
    iconBgColor: '#E3F2FD',
    iconColor: '#1976D2',
    value: 37,
    label: 'Total users',
    trend: {
      value: 17,
      direction: 'up',
      isPositive: true,
      label: 'Since last week',
    },
  },
  {
    id: 'conversations',
    icon: React.createElement(ChatIcon),
    iconBgColor: '#FFE0B2',
    iconColor: '#F57C00',
    value: 57,
    label: 'Conversations',
    trend: {
      value: 6,
      direction: 'up',
      isPositive: true,
      label: 'Since last week',
    },
  },
  {
    id: 'adoption-rate',
    icon: React.createElement(TrendingUpIcon),
    iconBgColor: '#C8E6C9',
    iconColor: '#388E3C',
    value: '7%',
    label: 'Adoption rate',
    trend: {
      value: 2.84,
      direction: 'down',
      isPositive: false,
      label: 'since last week',
    },
  },
  {
    id: 'avg-latency',
    icon: React.createElement(AccessTimeIcon),
    iconBgColor: '#FFCDD2',
    iconColor: '#D32F2F',
    value: '120ms',
    label: 'Avg. latency',
    trend: {
      value: 27,
      direction: 'up',
      isPositive: false,
      label: 'Since last week',
    },
  },
  {
    id: 'avg-csat',
    icon: React.createElement(SentimentSatisfiedIcon),
    iconBgColor: '#FFF9C4',
    iconColor: '#F9A825',
    value: 3.8,
    label: 'Avg. CSAT',
    trend: {
      value: 2.84,
      direction: 'down',
      isPositive: false,
      label: 'since last week',
    },
  },
  {
    id: 'token-usage',
    icon: React.createElement(DataUsageIcon),
    iconBgColor: '#E1BEE7',
    iconColor: '#7B1FA2',
    value: 47300,
    label: 'Token usage',
    trend: {
      value: 2.84,
      direction: 'down',
      isPositive: true,
      label: 'since last week',
    },
  },
];

/**
 * Mock alerts data
 */
export const mockAlerts: AlertData[] = [
  {
    id: 'alert-1',
    severity: 'warning',
    message: 'Spike detected: Token usage exceeded normal range by 45%.',
    timestamp: new Date(),
  },
  {
    id: 'alert-2',
    severity: 'warning',
    message: 'Spike detected: Token usage exceeded normal range by 45%.',
    timestamp: new Date(),
  },
  {
    id: 'alert-3',
    severity: 'warning',
    message: 'Spike detected: Token usage exceeded normal range by 45%.',
    timestamp: new Date(),
  },
  {
    id: 'alert-4',
    severity: 'warning',
    message: 'Spike detected: Token usage exceeded normal range by 45%.',
    timestamp: new Date(),
  },
];

/**
 * Mock CSAT data for bar chart
 */
export const mockCSATData: CSATDataPoint[] = [
  { date: '17 Apr', score: 0.38 },
  { date: '18 Apr', score: 0.63 },
  { date: '23 Apr', score: 0.95 },
  { date: '27 Apr', score: 0.58 },
  { date: '1 May', score: 0.43 },
];

/**
 * Mock user trend data for area chart
 */
export const mockUserTrendData: UserTrendDataPoint[] = [
  { month: 'Apr', users: 10 },
  { month: 'May', users: 35 },
  { month: 'Jun', users: 70 },
  { month: 'Jul', users: 65 },
  { month: 'Aug', users: 90 },
  { month: 'Sep', users: 65 },
  { month: 'Oct', users: 20 },
  { month: 'Nov', users: 0 },
];

/**
 * Mock token trend data for line chart
 */
export const mockTokenTrendData: TokenTrendDataPoint[] = [
  { month: 'Apr', tokens: 10000 },
  { month: 'May', tokens: 15000 },
  { month: 'Jun', tokens: 35000 },
  { month: 'Jul', tokens: 28000 },
  { month: 'Aug', tokens: 30000 },
  { month: 'Sep', tokens: 50000 },
  { month: 'Oct', tokens: 37000 },
  { month: 'Nov', tokens: 47000 },
];

/**
 * Mock applications for dropdown
 */
export const mockApplications: DropdownOption[] = [
  { label: 'Banking bot', value: 'banking-bot' },
  { label: 'Customer Support AI', value: 'support-ai' },
  { label: 'Sales Assistant', value: 'sales-assistant' },
  { label: 'HR Chatbot', value: 'hr-chatbot' },
];
import dayjs from 'dayjs';

/**
 * Format large numbers with K/M notation
 * @example formatNumber(47300) -> "47.3k"
 * @example formatNumber(1500000) -> "1.5M"
 */
export const formatNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toString();
};

/**
 * Format percentage values
 * @example formatPercentage(0.85) -> "85%"
 */
export const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(0)}%`;
};

/**
 * Format dates consistently
 * @example formatDate(new Date(), 'MMM D, YYYY') -> "Nov 25, 2025"
 */
export const formatDate = (
  date: Date | string,
  format: string = 'MMM D, YYYY'
): string => {
  return dayjs(date).format(format);
};

/**
 * Format date range for display
 * @example formatDateRange(date1, date2) -> "Apr 17, 2025 - Nov 21, 2025"
 */
export const formatDateRange = (from: Date, to: Date): string => {
  return `${formatDate(from, 'MMM D, YYYY')} - ${formatDate(to, 'MMM D, YYYY')}`;
};

/**
 * Get trend color based on direction and context
 * @param direction - 'up' or 'down'
 * @param isPositive - whether the trend direction is good or bad
 * @returns color hex code
 */
export const getTrendColor = (
  direction: 'up' | 'down',
  isPositive: boolean
): string => {
  if (direction === 'up') {
    return isPositive ? '#28a745' : '#dc3545'; // Green : Red
  } else {
    return isPositive ? '#dc3545' : '#28a745'; // Red : Green
  }
};
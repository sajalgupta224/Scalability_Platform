/**
 * Chart-Related Types
 * Types for chart configurations and data structures
 */

/**
 * Bar stack configuration for stacked bar charts
 */
export interface BarStackConfig {
  dataKey: string;
  stackId: string;
  fill: string;
  name: string;
}

/**
 * Donut chart data structure
 */
export interface DonutChartData {
  name: string;
  value: number;
}

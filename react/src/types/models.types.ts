/**
 * Model-Related Types
 * Types for AI model metrics and comparison data
 */

/**
 * Model performance metrics
 */
export interface ModelMetrics {
  latency: number; // in ms
  inputTokens: number;
  outputTokens: number;
  totalCost: number; // in dollars
  totalConversations?: number;
  successRate?: number;
}

/**
 * Model comparison data structure
 */
export interface ModelComparisonData {
  modelName: string;
  response: string;
  metrics: ModelMetrics;
}

/**
 * Page-Specific Types
 * Types used in specific pages that may be shared across components
 */

/**
 * Chat item structure for chat history
 */
export interface ChatItem {
  user: string;
  bot: string | Record<string, string>;
  // Optional: buffered 'thinking' text (either common string or per-model map)
  thinking?: string | Record<string, string>;
}

/**
 * Deployed Application entity
 */
export interface DeployedApplication {
  id: string;
  name: string;
}

/**
 * Cost calculation data
 */
export interface CostData {
  startTime: string;
  computePoolName: string;
  estimatedCost: number;
}

/**
 * Cost API response item
 */
export interface CostApiResponseItem {
  APPLICATION_NAME: string;
  COMPUTE_POOL_NAME: string;
  START_TIME: string;
  COMPUTE_CREDITS: number;
  ESTIMATED_COST: number;
}

/**
 * Schema mapping by database
 */
export type SchemasByDb = Record<string, string[]>;

/**
 * Files mapping by location
 */
export type FilesByLocation = Record<string, string[]>;
export type StagesByDbSchema = Record<string, string[]>;
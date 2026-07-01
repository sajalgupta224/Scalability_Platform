/**
 * Snowflake-Related Types
 * Types for Snowflake API responses and data structures
 */

/**
 * Snowflake role data
 */
export interface RoleData {
  ROLE: string;
}

/**
 * Cost history item
 */
export interface CostHistoryItem {
  START_TIME: string;
  COMPUTE_POOL_NAME: string;
  ESTIMATED_COST: number;
}

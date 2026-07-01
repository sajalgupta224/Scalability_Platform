/**
 * Snowflake Metrics Types
 * Types for the Snowflake Metrics dashboard page
 */

export type MetricsTabKey = "credits" | "queries" | "storage" | "warehouse";

/** Generic API response wrapper from /api/sf-metrics/* endpoints */
export interface SfMetricsResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
  details?: string;
}

/* ─── Credit & Cost ─── */

export interface WarehouseCreditRow {
  WAREHOUSE_NAME: string;
  USAGE_DATE: string;
  CREDITS_USED: number;
  CREDITS_COMPUTE: number;
  CREDITS_CLOUD: number;
}

export interface DailyMeteringRow {
  SERVICE_TYPE: string;
  USAGE_DATE: string;
  CREDITS_USED: number;
  CREDITS_BILLED: number;
  CREDITS_ADJUSTMENT_CLOUD_SERVICES: number;
}

export interface CortexAIRow {
  FUNCTION_NAME: string;
  MODEL_NAME: string | null;
  USAGE_DATE: string;
  CREDITS: number;
  CALL_COUNT: number;
}

export interface CortexAgentRow {
  AGENT_NAME: string;
  AGENT_DATABASE_NAME: string;
  USER_NAME: string | null;
  USAGE_DATE: string;
  TOKENS: number;
  TOKEN_CREDITS: number;
}

/* ─── Query Performance ─── */

export interface QueryPerformanceRow {
  TOTAL_QUERIES: number;
  AVG_DURATION_SEC: number;
  P95_DURATION_SEC: number;
  FAILED_QUERIES: number;
  AVG_QUEUED_SEC: number;
  AVG_BLOCKED_SEC: number;
  AVG_BYTES_SCANNED: number;
  AVG_ROWS_PRODUCED: number;
}

export interface QueryTrendRow {
  QUERY_DATE: string;
  TOTAL_QUERIES: number;
  AVG_DURATION_SEC: number;
  FAILED_QUERIES: number;
  AVG_QUEUED_SEC: number;
}

export interface CostliestQueryRow {
  QUERY_ID: string;
  QUERY_TEXT: string;
  USER_NAME: string;
  WAREHOUSE_NAME: string;
  QUERY_TYPE: string;
  START_TIME: string;
  DURATION_SEC: number;
  CLOUD_CREDITS: number;
  BYTES_SCANNED: number;
  PARTITIONS_SCANNED: number;
  EXECUTION_STATUS: string;
}

export interface UserActivityRow {
  USER_NAME: string;
  QUERY_COUNT: number;
  TOTAL_CLOUD_CREDITS: number;
  AVG_ELAPSED_MS: number;
  FAILED_QUERIES: number;
}

/* ─── Storage ─── */

export interface DatabaseStorageRow {
  DATABASE_NAME: string;
  USAGE_DATE: string;
  AVG_DB_GB: number;
  AVG_FAILSAFE_GB: number;
}

export interface TableStorageRow {
  TABLE_CATALOG: string;
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  ACTIVE_MB: number;
  TIME_TRAVEL_MB: number;
  FAILSAFE_MB: number;
  CLONE_MB: number;
}

/* ─── Warehouse ─── */

export interface WarehouseLoadRow {
  WAREHOUSE_NAME: string;
  TIME_SLOT: string;
  AVG_RUNNING: number;
  AVG_QUEUED_LOAD: number;
  AVG_QUEUED_PROVISIONING: number;
  AVG_BLOCKED: number;
}

export interface WarehouseEventRow {
  WAREHOUSE_NAME: string;
  EVENT_TIME: string;
  EVENT_NAME: string;
  EVENT_REASON: string | null;
  CLUSTER_NUMBER: number | null;
}

/** SHOW WAREHOUSES returns lowercase column names via the Snowflake Node.js SDK */
export interface WarehouseStatusRow {
  name: string;
  state: string;
  type: string;
  size: string;
  min_cluster_count: number;
  max_cluster_count: number;
  started_clusters: number;
  running: number;
  queued: number;
  is_default: string;
  is_current: string;
  auto_suspend: number;
  auto_resume: string;
  scaling_policy: string;
}

/* ─── Query Optimization Recommendations ─── */

export interface QueryRecommendation {
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}

export interface QueryRecommendationsResponse {
  recommendations: QueryRecommendation[];
  summary: string;
  queriesAnalyzed: number;
}

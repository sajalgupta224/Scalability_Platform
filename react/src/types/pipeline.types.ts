/**
 * Pipeline-Related Types
 * Types for pipeline API responses and data structures
 */

import type { FileSourceType } from './dataPreparation';

/**
 * Pipeline data for list view
 */
export interface PipelineData {
  PIPELINE_ID: string;
  PIPELINE_NAME: string;
}

/**
 * Pipeline submission request payload
 */
export interface PipelineSubmitRequest {
  pipelineName: string;
  dataSourceType: FileSourceType;
  selectedDb: string | null;
  selectedSchema: string | null;
  fileLocation?: string | null;
  selectedFiles?: string | string[] | null;
  chunkingMethod?: string | null;
  chunkSize?: number | null;
  chunkOverlap?: number | null;
  chunkTable?: string | null;
  cortexSearchService?: string | null;
  semanticView?: string[] | null;
  semanticModel?: string | null;
  userId: number | null;
}

/**
 * Pipeline update request payload
 */
export interface PipelineUpdateRequest {
  pipelineId: string;
  pipelineName: string;
  dataSourceType: FileSourceType;
  selectedDb: string | null;
  selectedSchema: string | null;
  fileLocation?: string | null;
  selectedFiles?: string | string[] | null;
  chunkingMethod?: string | null;
  chunkSize?: number | null;
  chunkOverlap?: number | null;
  chunkTable?: string | null;
  cortexSearchService?: string | null;
  semanticView?: string[] | null;
  semanticModel?: string | null;
  userId: number | null;
}

/**
 * Pipeline submission response
 */
export interface PipelineSubmitResponse {
  pipelineId: number | string;
  status: string;
  message?: string;
}

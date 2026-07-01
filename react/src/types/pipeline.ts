// Pipeline Configuration Types

import type { FileSourceType } from './dataPreparation';

export interface PipelineConfigurationData {
  dataPipelineName: string;
  fileSourceType: FileSourceType;
  fileLocation?: string;
  fileType?: string;
}

export interface ChunkingDetailsData {
  chunkingMethod: string;
  chunkingSize: number;
  chunkOverlap: number;
  chunkTable: string;
  cortexSearchService: string;
}
export interface DatabaseDetailsData {
  selectedDb: string;
  selectedSchema: string;
  semanticView: string;
  semanticModel: string;
}

export interface PipelineConfigResponse {
  id: string;
  pipelineConfiguration: PipelineConfigurationData;
  chunkingDetails?: ChunkingDetailsData;
  databaseDetails?: DatabaseDetailsData;
}

export interface ConfigurationRow {
  field: string;
  value: string | number;
  icon?: React.ReactNode;
}

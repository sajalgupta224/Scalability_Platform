// dataPreparation.ts
export type FileSourceType = 'cloud' | 'database';

export type TableConfig = {
  textColumn: string | null;        // REQUIRED per table
  attributeColumns: string[];       // optional
  filter?: string;                  // optional (WHERE clause without 'WHERE')
};

export interface PipelineFormData {
  pipelineName: string;
  dataSourceType: FileSourceType | null;
  selectedDb: string | null;
  selectedSchema: string | null;
  // CLOUD-only
  fileLocation: string | null;
  selectedFiles: string[];
  chunkingMethod: string | null;
  chunkSize: number | null;
  chunkOverlap: number | null;
  chunkTable?: string | null;
  cortexSearchService?: string | null;

  // DATABASE talk-to-data fields (semantic)
  semanticView?: string[];
  semanticModel?: string | null;
  // stage selected for Talk-to-Data when using stages
  stage?: string | null;

  // DATABASE talk-to-document fields
  serviceNameBase?: string | null;
  selectedTables?: string[];                       // multi tables
  tableConfigs?: Record<string, TableConfig>;      // per-table config
  createdSearchServices?: Record<string, string>;  // table -> serviceName
}

export interface FormErrors {
  pipelineName?: string;
  sourceType?: string;
  database?: string;
  schema?: string;

  // cloud
  fileLocation?: string;
  selectedFile?: string;
  chunkingMethod?: string;
  chunkSize?: string;
  chunkOverlap?: string;

  // ✅ new database validation
  serviceNameBase?: string;
  selectedTables?: string;

  // per-table errors
  tableConfigs?: Record<string, { textColumn?: string }>;

  domainName?: string;
}

export interface ChunkingPayload {
  db: string;
  schema: string;
  stage: string;
  fileName: string;
  chunkMethod: string;
  chunkSize: number;
  chunkOverlap: number;
  pipelineName: string;
}

export interface ChunkingResponse {
  success: boolean;
  message: string;
  tables: string[];
  error?: string;
}

import { apiClient } from '../client';
import type { Pipeline } from '../../types/chatbot';
import type {
  PipelineData,
  PipelineSubmitRequest,
  PipelineSubmitResponse,
  PipelineUpdateRequest
} from '../../types/pipeline.types';
import type { PipelineConfigResponse } from '../../types/pipeline';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

type CheckPipelineNameResponse = {
  success: boolean;
  exists: boolean;
  message?: string;
};

type UploadDocumentResponse = {
  success: boolean;
  uploaded: boolean;
  file_name: string;
  stage_path?: string;
  result?: any;
  message?: string;
  details?: string;
};

export const PipelineAPI = {
  submitPipeline: async (pipelineObj: PipelineSubmitRequest): Promise<PipelineSubmitResponse> => {
    return apiClient.post<PipelineSubmitResponse>('/api/submit-pipeline', pipelineObj);
  },

  updatePipeline: async (pipelineObj: PipelineUpdateRequest): Promise<PipelineSubmitResponse> => {
    const p: any = { ...pipelineObj };

    const payload: any = {};
    if (p.pipelineId !== undefined) payload.pipeline_id = p.pipelineId;
    if (p.pipelineName !== undefined) payload.pipeline_name = p.pipelineName;
    if (p.dataSourceType !== undefined) payload.file_source_type = p.dataSourceType;
    if (p.selectedDb !== undefined) payload.database = p.selectedDb;
    if (p.selectedSchema !== undefined) payload.schema = p.selectedSchema;

    if (p.fileLocation !== undefined) payload.file_location = p.fileLocation;
    if (p.selectedFiles !== undefined) {
      payload.file_type = Array.isArray(p.selectedFiles)
        ? p.selectedFiles.join(', ')
        : p.selectedFiles;
    }

    if (p.chunkingMethod !== undefined) payload.chunking_method = p.chunkingMethod;
    if (p.chunkSize !== undefined) payload.chunk_size = p.chunkSize;
    if (p.chunkOverlap !== undefined) payload.chunk_overlap = p.chunkOverlap;
    if (p.chunkTable !== undefined) payload.chunk_table = p.chunkTable;
    if (p.cortexSearchService !== undefined) payload.cortex_search_service = p.cortexSearchService;

    if (p.tableName !== undefined) payload.table_name = p.tableName;
    if (p.columnName !== undefined) payload.column_name = p.columnName;
    if (p.rowFilter !== undefined) payload.row_filter = p.rowFilter;

    if (p.semanticView !== undefined) payload.semantic_view = p.semanticView;
    if (p.semanticModel !== undefined) payload.semantic_model = p.semanticModel;

    if (p.stream !== undefined) payload.stream = p.stream;
    if (p.task !== undefined) payload.task = p.task;

    if (p.userId !== undefined) payload.user_id = p.userId;

    for (const k of Object.keys(p)) {
      if (
        ![
          'pipelineId',
          'pipelineName',
          'dataSourceType',
          'selectedDb',
          'selectedSchema',
          'fileLocation',
          'selectedFiles',
          'chunkingMethod',
          'chunkSize',
          'chunkOverlap',
          'chunkTable',
          'cortexSearchService',
          'tableName',
          'columnName',
          'rowFilter',
          'semanticView',
          'semanticModel',
          'stream',
          'task',
          'userId'
        ].includes(k)
      ) {
        payload[k] = p[k];
      }
    }

    return apiClient.post<PipelineSubmitResponse>('/api/update-pipeline', payload);
  },

  getPipelines: async (mode?: string): Promise<PipelineData[]> => {
    const params = mode ? { mode } : {};
    return apiClient.get<PipelineData[]>('/pipelines', { params });
  },

  getPipelineById: async (id: string | number): Promise<Pipeline> => {
    return apiClient.get<Pipeline>(`/pipelines/${id}`);
  },

  getPipelineConfiguration: async (id: string): Promise<PipelineConfigResponse> => {
    return apiClient.get<PipelineConfigResponse>(`/api/pipeline-configuration/${id}`);
  },

  /**
   * Upload document (PDF, DOC, DOCX, TXT) from local machine to backend
   * Backend URL: http://localhost:5000/pipelines/upload-document
   */
  uploadDocument: async (file: File, db?: string, schema?: string, stage?: string): Promise<UploadDocumentResponse> => {
    const formData = new FormData();

    formData.append('file', file);
    if (db) formData.append('db', db);
    if (schema) formData.append('schema', schema);
    if (stage) formData.append('stage', stage);

    const res = await fetch(`${API_BASE}/pipelines/upload-document`, {
      method: 'POST',
      body: formData,
    });

    let json: UploadDocumentResponse | null = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const errMsg = json?.details
        ? `${json.message || 'Failed to upload document'}: ${json.details}`
        : (json?.message || 'Failed to upload document');
      throw new Error(errMsg);
    }

    if (!json?.success || !json?.uploaded) {
      const errMsg = json?.details
        ? `${json.message || 'Document upload failed'}: ${json.details}`
        : (json?.message || 'Document upload failed');
      throw new Error(errMsg);
    }

    return json;
  },

  /**
   * IMPORTANT:
   * Using fetch directly here to avoid any apiClient response shape issue.
   */
  checkPipelineNameExists: async (
    pipelineName: string,
    pipelineId?: string | number
  ): Promise<boolean> => {
    const params = new URLSearchParams();
    params.append('pipelineName', pipelineName);

    if (
      pipelineId !== undefined &&
      pipelineId !== null &&
      String(pipelineId).trim() !== ''
    ) {
      params.append('pipelineId', String(pipelineId));
    }

    const url = `${API_BASE}/api/check-pipeline-name?${params.toString()}`;

    console.log('[checkPipelineNameExists] GET:', url);

    const res = await fetch(url);

    let json: CheckPipelineNameResponse | null = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    console.log('[checkPipelineNameExists] response:', json);

    if (!res.ok) {
      throw new Error(json?.message || 'Failed to validate pipeline name');
    }

    return json?.exists === true;
  },

  /**
   * Upload a document to UPLOAD_STAGE for chat document processing.
   * Backend URL: POST /api/upload-chat-document
   */
  uploadChatDocument: async (file: File, stage?: string): Promise<{ success: boolean; file_name: string; file_type: string; stage_path?: string; text_content?: string; message?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (stage) formData.append('stage', stage);

    const res = await fetch(`${API_BASE}/api/upload-chat-document`, {
      method: 'POST',
      body: formData,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      throw new Error(json?.message || 'Failed to upload chat document');
    }

    if (!json?.success) {
      throw new Error(json?.message || 'Chat document upload failed');
    }

    return json;
  },

  /**
   * Process an uploaded chat document with multi-model.
   * Backend URL: POST /api/process-uploaded-chat-multi-model
   */
  processUploadedChatMultiModel: async (params: {
    file_name: string;
    file_type: string;
    user_instruction: string;
    user_name: string;
    models: string;
    text_content?: string;
  }): Promise<{ success: boolean; data: any }> => {
    const res = await fetch(`${API_BASE}/api/process-uploaded-chat-multi-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      throw new Error(json?.error || 'Failed to process uploaded chat document');
    }

    if (!json?.success) {
      throw new Error(json?.error || 'Processing uploaded chat document failed');
    }

    return json;
  },

  /**
   * Process an uploaded PDF for Talk to Data mode (structured analysis).
   * Backend URL: POST /api/process-uploaded-data-analysis
   * Returns structured data: sql, rows, chartSpec, planningText, etc.
   */
  processUploadedDataAnalysis: async (params: {
    file_name: string;
    file_type: string;
    user_instruction: string;
    user_name: string;
  }): Promise<{
    agent: string;
    planningText: string;
    answerText: string;
    keyInsights: string[];
    sql: string;
    rows: any[];
    chartSpec: any;
    queryId: string | null;
    queryIdVerified: boolean;
    error?: string;
  }> => {
    const res = await fetch(`${API_BASE}/api/process-uploaded-data-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error || 'Failed to process uploaded document for data analysis');
    }

    return json;
  },
};

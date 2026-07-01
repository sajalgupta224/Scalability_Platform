import { apiClient } from '../client';
import type {
  ComplianceCheckRequest,
  ComplianceCheckResponse,
  RAComplianceData,
} from '../../types/racompliance.types';

export const RAComplianceAPI = {
  getCompliances: (): Promise<RAComplianceData[]> => {
    return apiClient.get<RAComplianceData[]>('/api/compliances');
  },

  getComplianceById: (id: string | number): Promise<RAComplianceData> => {
    return apiClient.get<RAComplianceData>(`/api/compliances/${id}`);
  },

  createComplianceCheck: async (
    request: ComplianceCheckRequest
  ): Promise<ComplianceCheckResponse> => {
    const res = await apiClient.post('/api/create-compliances', request);

    // Axios returns { data, status, ... }. We want the payload in res.data.
    const raw = (res && typeof res === 'object' && 'data' in res ? (res as any).data : res) as any;

    // Snowflake and some drivers may return an array for RETURNING; handle both.
    const row = Array.isArray(raw) ? raw[0] : raw;

    const id =
      row?.REGULATION_ID ??
      row?.regulationId ??
      row?.complianceId ??
      row?.id;

    const name =
      row?.REGULATION_NAME ??
      row?.regulationName ??
      row?.COMPLIANCE_NAME ??
      row?.name;

    if (id == null) {
      throw new Error(`createComplianceCheck: Missing id in response. Got: ${JSON.stringify(raw)}`);
    }

    return {
      complianceId: Number(id),
      regulationName: String(name ?? request.regulationName),
    };
  },
};
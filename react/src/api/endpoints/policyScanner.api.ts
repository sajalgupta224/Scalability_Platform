import { apiClient } from '../client';
import type {
  AddPolicyRequest,
  AddPolicyResponse,
  ApprovePoliciesRequest,
  ApprovePoliciesResponse,
  GenerateReportRequest,
  GenerateReportResponse,
  GetDatabasesResponse,
  GetPoliciesResponse,
  GetSchemasResponse,
  GetTablesResponse,
  PolicyItem,
  RawPolicyItem,
  RegeneratePolicyRequest,
  RegeneratePolicyResponse,
  RegenerateSQLRequest,
  RegenerateSQLResponse,
  SaveMappingRequest,
  SaveMappingResponse,
  SavePoliciesRequest,
  SavePoliciesResponse,
  ScheduleJobRequest,
  ScheduleJobResponse,
} from '../../types/policyScanner.types';
import axios from 'axios';

/** =========================================================
 * ✅ Helpers
 * ========================================================= */

function toRegulationId(input: unknown): number {
  const n = Number(input);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid regulationId: ${String(input)}. Must be a positive integer.`);
  }
  return n;
}

function withRegulationId(url: string, regulationId: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}regulationId=${encodeURIComponent(String(regulationId))}`;
}

/**
 * apiClient sometimes returns AxiosResponse-like { data: ... } OR just data.
 * This helper normalizes it.
 */
function unwrap<T = any>(resp: any): T {
  return resp && typeof resp === 'object' && 'data' in resp ? (resp.data as T) : (resp as T);
}

/**
 * ✅ Decode HTML entities from backend
 * Your remediation SQL includes "&lt;=" in JSON, so we decode it to "<="
 * Handles both "&lt;" and double-escaped "&amp;lt;" cases.
 */
function decodeHtmlEntities(input: string): string {
  if (!input) return input;

  // Browser-safe decode
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = input;
    const firstPass = textarea.value;

    // If double-escaped, decode again
    if (
      firstPass.includes('&lt;') ||
      firstPass.includes('&gt;') ||
      firstPass.includes('&amp;')
    ) {
      textarea.innerHTML = firstPass;
      return textarea.value;
    }
    return firstPass;
  }

  // SSR/test fallback
  return input
    .replace(/&amp;amp;lt;/g, '<')
    .replace(/&amp;amp;gt;/g, '>')
    .replace(/&amp;amp;amp;/g, '&')
    .replace(/&amp;amp;quot;/g, '"')
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;lt;/g, '<')
    .replace(/&amp;gt;/g, '>')
    .replace(/&amp;amp;/g, '&')
    .replace(/&amp;quot;/g, '"');
}

/** =========================================================
 * ✅ Step 1 raw policy transform
 * ========================================================= */

const transformRawPolicy = (raw: RawPolicyItem): PolicyItem => ({
  id: raw.POLICY_ID,
  policyId: raw.POLICY_ID,
  policyDescription: raw.POLICY_TEXT,
  policyType: raw.POLICY_TYPE,
  citations: raw.CITATION_DOC,

  // ✅✅✅ FIX: map backend ARTICLEDISPLAY to UI articleDisplay
  articleDisplay: (raw as any).ARTICLEDISPLAY ?? '',

  complianceDataRequirement: raw.COMPLIANCE_DATA_REQUIREMENT,
  comments: raw.REGENERATION_COMMENT,
  approvalStatus: raw.APPROVAL_STATUS,
  createdAt: (raw as any).CREATED_AT ?? '',
  selected: false,
});

/** =========================================================
 * ✅ Agent response type
 * ========================================================= */

interface AgentApiResponse {
  success: boolean;
  message?: string;
  agent_raw?: unknown;
  agent_text?: string;
  error?: string;
}

const defaultPrompt = 'list all the policies of gdpr where regulation id is 1';

/** =========================================================
 * Step 1: Review Policies API
 * ========================================================= */

export const ReviewPoliciesAPI = {
  fetchPoliciesFromAgent: async (prompt: string = defaultPrompt): Promise<AgentApiResponse> => {
    try {
      const response = await apiClient.post<AgentApiResponse>('/api/policies-from-agent', { prompt });
      return unwrap<AgentApiResponse>(response);
    } catch (error) {
      console.error('Agent API call failed:', error);
      throw error;
    }
  },

  getPolicies: async (complianceId: string): Promise<GetPoliciesResponse> => {
    try {
      const regulationId = toRegulationId(complianceId);
      const url = withRegulationId('/api/policies', regulationId);

      const response = await apiClient.get(url);
      const body = unwrap<any>(response);

      const rows: RawPolicyItem[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const policies = (rows || []).map(transformRawPolicy);

      return {
        success: true,
        message: 'Policies retrieved successfully',
        policies,
      };
    } catch (error) {
      console.error('Error fetching policies:', error);
      return {
        success: false,
        message: (error as any)?.message ?? 'Failed to fetch policies',
        policies: [],
      };
    }
  },

  savePolicies: async (_request: SavePoliciesRequest): Promise<SavePoliciesResponse> => {
    // TODO: implement backend
    return { success: true, message: 'Policies saved successfully' };
  },

  addPolicy: async (request: AddPolicyRequest): Promise<AddPolicyResponse> => {
    // TODO: implement backend
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newPolicy: PolicyItem = {
      id: `policy-${Date.now()}`,
      policyId: '-',
      policyDescription: request.policyDescription,
      citations: '-',
      articleDisplay: '', // ✅ keep field present
      comments: '',
      approvalStatus: '',
      selected: false,
      autoGeneratedTable: '-',
      suggestedCount: 0,
    };

    return {
      success: true,
      message: 'Policy added successfully',
      policy: newPolicy,
    };
  },

  
approvePolicies: async (request: any): Promise<ApprovePoliciesResponse> => {
  try {
    const resp: any = await apiClient.post('/api/approvePolicies', request);
    const body = unwrap<any>(resp);

    // ✅ Accept multiple backend success formats
    const ok =
      body?.success === true ||
      String(body?.status).toUpperCase() === 'SUCCESS' ||
      String(body?.result).toUpperCase() === 'SUCCESS';

    return {
      success: ok,
      message: body?.message ?? 'Policies approved successfully',
    };
  } catch (error: any) {
    console.error('Error approving policies:', error);
    return {
      success: false,
      message: error?.response?.data?.message ?? error?.message ?? 'Failed to approve policies',
    };
  }
},


  regeneratePolicies: async (_request: RegeneratePolicyRequest): Promise<RegeneratePolicyResponse> => {
    // TODO: implement backend
    return { success: true, message: 'Policies regenerated successfully', policies: [] };
  },
};

/** =========================================================
 * Step 2: Approved Policies API
 * ========================================================= */

export const ApprovedPoliciesAPI = {
  getPolicies: async (complianceId: string): Promise<GetPoliciesResponse> => {
    try {
      const regulationId = toRegulationId(complianceId);
      const url = withRegulationId('/api/policies/approved', regulationId);

      const response = await apiClient.get(url);
      const body = unwrap<any>(response);

      const rows: RawPolicyItem[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const policies = (rows || []).map(transformRawPolicy);

      return {
        success: true,
        message: 'Policies retrieved successfully',
        policies,
      };
    } catch (error) {
      console.error('Error fetching approved policies:', error);
      return {
        success: false,
        message: (error as any)?.message ?? 'Failed to fetch approved policies',
        policies: [],
      };
    }
  },
};

/** =========================================================
 * Step 3: Snowflake Mapping API
 * ========================================================= */

interface RawPolicyMappingDbRow {
  REGULATION_ID: number;
  POLICY_ID: number;
  POLICY_TEXT: string;

  TARGET_DATABASE: string;
  TARGET_SCHEMA: string;
  TARGET_TABLE: string;
  TARGET_COLUMN: string;

  APPROVAL_STATUS: string;

  COMPLIANCE_DATA_REQUIREMENT?: string;
  MATCH_SCORE?: number;
  MATCH_REASON?: string;

  MAPPING_ID?: number;
  APPROVED_AT?: string;
  CREATED_AT?: string;
  SEMANTIC_VIEW_NAME?: string;
  APPROVED_BY?: string | null;
}

function aggregateMappingRowsToPolicies(rows: RawPolicyMappingDbRow[]): PolicyItem[] {
  const byPolicy = new Map<
    string,
    {
      base: RawPolicyMappingDbRow;
      tables: Set<string>;
      columns: Set<string>;
      mappingIds: Set<string>;
    }
  >();

  for (const r of rows || []) {
    const key = String(r.POLICY_ID);

    if (!byPolicy.has(key)) {
      byPolicy.set(key, {
        base: r,
        tables: new Set<string>(),
        columns: new Set<string>(),
        mappingIds: new Set<string>(),
      });
    }

    const agg = byPolicy.get(key)!;

    if (r.TARGET_TABLE) agg.tables.add(String(r.TARGET_TABLE));

    if (r.TARGET_COLUMN) {
      const tc = r.TARGET_TABLE ? `${r.TARGET_TABLE}.${r.TARGET_COLUMN}` : String(r.TARGET_COLUMN);
      agg.columns.add(tc);
    }

    if (r.MAPPING_ID !== undefined && r.MAPPING_ID !== null) {
      agg.mappingIds.add(String(r.MAPPING_ID));
    }
  }

  return Array.from(byPolicy.values()).map(({ base, tables, columns, mappingIds }) => {
    const tablesList = Array.from(tables);
    const columnsList = Array.from(columns);
    const mappingIdList = Array.from(mappingIds);

    return {
      id: base.POLICY_ID,
      policyId: base.POLICY_ID,
      policyDescription: base.POLICY_TEXT ?? '',
      policyType: '',

      citations: '',
      articleDisplay: '', // mapping API doesn't send it
      complianceDataRequirement: base.COMPLIANCE_DATA_REQUIREMENT ?? '',
      comments: '',
      approvalStatus: base.APPROVAL_STATUS ?? '',
      selected: false,

      autoGeneratedTable: tablesList.join(', '),
      targetTableColumns: columnsList.join(', '),
      suggestedCount: columnsList.length || tablesList.length,

      database: base.TARGET_DATABASE ?? '',
      schema: base.TARGET_SCHEMA ?? '',
      targetTable: base.TARGET_TABLE ?? '',

      mappingIds: mappingIdList.join(', '),

      approvedAt: base.APPROVED_AT ?? '',
      createdAt: base.CREATED_AT ?? '',
    };
  });
}

export const SnowflakeMappingAPI = {
  mappingAgent: async (prompt: string = defaultPrompt): Promise<AgentApiResponse> => {
    try {
      const response = await apiClient.post<AgentApiResponse>('/api/mapping_agent', { prompt });
      return unwrap<AgentApiResponse>(response);
    } catch (error) {
      console.error('Agent API call failed:', error);
      throw error;
    }
  },

  getPolicies: async (complianceId: string): Promise<GetPoliciesResponse> => {
    try {
      const regulationId = toRegulationId(complianceId);
      const url = withRegulationId('/api/mapping', regulationId);

      const resp: any = await apiClient.get(url);
      const body = unwrap<any>(resp);

      const apiSuccess = typeof body?.success === 'boolean' ? body.success : true;
      const apiMessage = body?.message ?? 'Mapping fetched';

      const rows: RawPolicyMappingDbRow[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const policies = aggregateMappingRowsToPolicies(rows);

      return { success: apiSuccess, message: apiMessage, policies };
    } catch (err) {
      console.error('Error fetching mapping policies:', err);
      return { success: false, message: (err as any)?.message ?? 'Failed to fetch policies', policies: [] };
    }
  },

  getDatabases: async (): Promise<GetDatabasesResponse> => {
    try {
      const resp: any = await apiClient.get('/api/databases');
      const body = unwrap<any>(resp);
      const databases: string[] = Array.isArray(body) ? body : body?.data ?? [];
      return { success: true, message: 'Databases retrieved successfully', databases };
    } catch (error) {
      console.error('Error fetching databases:', error);
      return { success: false, message: (error as any)?.message ?? 'Failed', databases: [] };
    }
  },

  getSchemas: async (database: string): Promise<GetSchemasResponse> => {
    try {
      const resp: any = await apiClient.get(`/api/schemas?db=${encodeURIComponent(database)}`);
      const body = unwrap<any>(resp);
      const schemas: string[] = Array.isArray(body) ? body : body?.data ?? [];
      return { success: true, message: 'Schemas retrieved successfully', schemas };
    } catch (err) {
      console.error('Error fetching schemas:', err);
      return { success: false, message: 'Failed to fetch schemas', schemas: [] };
    }
  },

  getTables: async (database: string, schema: string): Promise<GetTablesResponse> => {
    try {
      const resp: any = await apiClient.get(
        `/api/tables?db=${encodeURIComponent(database)}&schema=${encodeURIComponent(schema)}`
      );
      const body = unwrap<any>(resp);
      const tables: string[] = Array.isArray(body) ? body : body?.data ?? [];
      return { success: true, message: 'Tables retrieved successfully', tables };
    } catch (err) {
      console.error('Error fetching tables:', err);
      return { success: false, message: 'Failed to fetch tables', tables: [] };
    }
  },

  saveMapping: async (_request: SaveMappingRequest): Promise<SaveMappingResponse> => {
    // TODO: implement backend
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, message: 'Mapping saved successfully' };
  },
};

/** =========================================================
 * Step 4: Mapped Policies API
 * ========================================================= */

interface MappingAgentResponse {
  success: boolean;
  message?: string;
  agent_raw?: unknown;
  agent_text?: string;
  error?: string;
}

export const MappedPoliciesAPI = {
  getPolicies: async (complianceId: string): Promise<GetPoliciesResponse> => {
    try {
      const regulationId = toRegulationId(complianceId);
      const url = withRegulationId('/api/mapping', regulationId);

      const resp: any = await apiClient.get(url);
      const body = unwrap<any>(resp);

      const rows: RawPolicyMappingDbRow[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const policies = aggregateMappingRowsToPolicies(rows);

      return { success: true, message: 'Mapped policies retrieved', policies };
    } catch (error) {
      console.error('Error fetching mapped policies:', error);
      return { success: false, message: (error as any)?.message ?? 'Failed to fetch mapped policies', policies: [] };
    }
  },

  savePolicies: async (request: SavePoliciesRequest): Promise<SavePoliciesResponse> => {
    try {
      const selected = (request.policies || []).filter((p) => p.selected);

      if (selected.length === 0) {
        return { success: false, message: 'No policies selected to save' };
      }

      const promptLines = selected.map((p) => {
        return `PolicyId=${p.policyId}; TargetTable=${p.autoGeneratedTable ?? ''}; Columns=${p.targetTableColumns ?? ''}; DeltaLoadComment=${p.commentsOnDeltaLoad ?? ''}`;
      });

      const prompt =
        `Save/update delta load comments for the following mapped policies (complianceId=${request.complianceId}).\n` +
        promptLines.join('\n');

      const resp = await apiClient.post<MappingAgentResponse>('/api/mapping_agent', { prompt });
      const body = unwrap<MappingAgentResponse>(resp);

      if (!body?.success) {
        return { success: false, message: body?.message || 'Save failed via mapping agent' };
      }

      return {
        success: true,
        message: body?.agent_text || body?.message || 'Saved successfully via mapping agent',
      };
    } catch (error) {
      console.error('Error saving mapped policies:', error);
      return { success: false, message: (error as any)?.message ?? 'Save failed' };
    }
  },

  approvePolicies: async (_request: ApprovePoliciesRequest): Promise<ApprovePoliciesResponse> => {
    // TODO: implement backend approve endpoint if needed
    return { success: true, message: 'Policies approved successfully (stub)' };
  },
};

/** =========================================================
 * Step 5: Compliance Check API
 * ========================================================= */

export const ComplianceCheckAPI = {
  getPolicies: async (complianceId: string): Promise<GetPoliciesResponse> => {
    try {
      const regulationId = toRegulationId(complianceId);
      const url = withRegulationId('/api/generated_sql', regulationId);

      const resp = await apiClient.get(url);
      const body = unwrap<any>(resp);

      let rows: any[] = [];
      if (Array.isArray(body)) rows = body;
      else if (body && Array.isArray(body.data)) rows = body.data;
      else if (body && body.data && Array.isArray(body.data.data)) rows = body.data.data;

      const policies = (rows || []).map(
        (r: any) =>
          ({
            id: r.COMPLIANCE_LOGIC_ID ?? r.compliance_logic_id ?? r.COMPLIANCE_LOGIC_ID,
            policyId: r.POLICY_ID ?? r.policy_id ?? r.POLICY_ID,
            policyDescription:
              r.POLICY_DESCRIPTION ?? r.POLICY_TEXT ?? r.policy_description ?? r.policy_text ?? '',
            policyType: r.POLICY_TYPE ?? r.policy_type ?? '',
            citations: r.CITATION_DOC ?? r.citation_doc ?? '',
            articleDisplay: r.ARTICLEDISPLAY ?? r.articleDisplay ?? '',
            complianceDataRequirement: r.COMPLIANCE_DATA_REQUIREMENT ?? r.compliance_data_requirement ?? '',
            comments: '',
            approvalStatus: r.APPROVAL_STATUS ?? r.approval_status ?? '',
            selected: false,
            generatedSQL: r.GENERATED_SQL ?? r.generated_sql ?? r.CC_CODE ?? r.cc_code ?? '',
            targetTable: r.TARGET_TABLE ?? r.target_table ?? '',
            targetTableColumns: r.TARGET_COLUMN ?? r.target_column ?? '',
          } as PolicyItem)
      );

      return { success: true, message: 'Compliance policies retrieved', policies };
    } catch (err) {
      console.error('Error fetching generated_sql:', err);
      return { success: false, message: (err as any)?.message ?? 'Failed to fetch policies', policies: [] };
    }
  },

  generateReport: async (request: GenerateReportRequest): Promise<GenerateReportResponse> => {
    try {
      const resp: any = await apiClient.post('/api/run-compliance', {
        complianceId: request.complianceId,
        policyId: request.policyId,
      });

      const body = unwrap<any>(resp);

      return {
        success: true,
        message: body?.message || 'Compliance process executed',
        reportUrl: body?.reportUrl ?? null,
      };
    } catch (error: any) {
      console.error('Error executing run-compliance:', error);
      return { success: false, message: error?.message ?? String(error), reportUrl: undefined };
    }
  },

  regenerateSQL: async (_request: RegenerateSQLRequest): Promise<RegenerateSQLResponse> => {
    // TODO: implement backend
    return { success: true, message: 'SQL regenerated successfully', policies: [] };
  },

  savePolicies: async (request: SavePoliciesRequest): Promise<SavePoliciesResponse> => {
    try {
      const policies = Array.isArray(request.policies) ? request.policies : [];
      if (!policies.length) return { success: false, message: 'No policies to save' };

      const toSave = policies.map((p: any) => ({
        policyId: p.policyId,
        generatedSQL: p.generatedSQL ?? p.remediationSQL ?? '',
        targetTable: p.targetTable ?? p.autoGeneratedTable ?? '',
        targetColumn: p.targetTableColumns ?? '',
        commentsOnSQL: p.commentsOnSQL ?? '',
      }));

      const prompt = `Save the following policies for complianceId=${request.complianceId}.
Return a short JSON status for each policy.
POLICIES:
${JSON.stringify(toSave, null, 2)}`;

      const resp: any = await apiClient.post('/api/mapping_agent', { prompt });
      const body = unwrap<any>(resp);

      if (body && body.success) return { success: true, message: body.message || 'Policies saved via agent' };

      const agentText = body?.agent_text ?? body?.agent_raw ?? null;
      return { success: true, message: String(agentText ?? 'Agent call completed') };
    } catch (err: any) {
      console.error('savePolicies failed:', err);
      return { success: false, message: err?.message ?? String(err) };
    }
  },

  approvePolicies: async (_request: ApprovePoliciesRequest): Promise<ApprovePoliciesResponse> => {
    // TODO: implement backend approve endpoint if needed
    return { success: true, message: 'Policies approved successfully' };
  },
};

/** =========================================================
 * Remediation Script + Remediation SQL shared types
 * ========================================================= */

interface RawRemediationItem {
  LOGICID: number | null;
  POLICYID: number;
  TARGETTABLE: string;
  TARGETCOLUMN: string;
  POLICYDESCRIPTION: string | null;
  REMEDIATIONSQL: string;
  APPROVALSTATUS: string;
  COMMENTS?: string;
}

interface RawRemediationResponse {
  limit: number;
  offset: number;
  items: RawRemediationItem[];
}

function transformRemediationItemToPolicyItem(raw: RawRemediationItem, index: number): PolicyItem {
  const stableId =
    raw.LOGICID !== null && raw.LOGICID !== undefined
      ? `${raw.LOGICID}-${index}`
      : `${raw.POLICYID}-${raw.TARGETTABLE}-${raw.TARGETCOLUMN}-${index}`;

  return {
    id: stableId,
    policyId: raw.POLICYID,

    policyDescription: raw.POLICYDESCRIPTION === null ? 'null' : (raw.POLICYDESCRIPTION ?? ''),

    remediationSQL: decodeHtmlEntities(raw.REMEDIATIONSQL ?? ''),
    commentsOnSQL: raw.COMMENTS ?? '',
    approvalStatus: raw.APPROVALSTATUS ?? '',
    selected: false,

    targetTable: raw.TARGETTABLE ?? '',
    targetTableColumns: raw.TARGETCOLUMN ?? '',

    citations: '',
    articleDisplay: '',
    comments: '',
  } as PolicyItem;
}

/** =========================================================
 * Remediation Script API (Page-1)
 * ========================================================= */

export const RemediationScriptAPI = {
  getPolicies: async (complianceId: string): Promise<GetPoliciesResponse> => {
    try {
      const url = `/api/remediation?regulationId=${encodeURIComponent(String(complianceId))}`;
      const resp: any = await apiClient.get(url);
      const body: any = unwrap<any>(resp);

      const payload: RawRemediationResponse =
        body?.items ? body : body?.data?.items ? body.data : body;

      const items: RawRemediationItem[] = Array.isArray(payload?.items) ? payload.items : [];
      const policies: PolicyItem[] = items.map((it, idx) => transformRemediationItemToPolicyItem(it, idx));

      return {
        success: true,
        message: 'Remediation scripts retrieved',
        policies,
      };
    } catch (error: any) {
      console.error('Error fetching remediation scripts:', error);
      return {
        success: false,
        message: error?.message ?? 'Failed to fetch remediation scripts',
        policies: [],
      };
    }
  },

  regenerateSQL: async (request: RegenerateSQLRequest): Promise<RegenerateSQLResponse> => {
    try {
      const url = `/api/compliance/remediation/regenerate`;

      const policyIds = Array.isArray(request.policyIds) ? request.policyIds : [];
      const userComment = (request.userComment ?? '').trim();

      if (policyIds.length === 0) {
        return { success: false, message: 'policyId is required', policies: [] };
      }
      if (!userComment) {
        return { success: false, message: 'userComment is required', policies: [] };
      }

      const calls = policyIds.map((pid) =>
        apiClient.post(url, {
          policyId: pid,
          userComment,
        })
      );

      const results = await Promise.allSettled(calls);

      const failed = results.find((r) => r.status === 'rejected');
      if (failed && failed.status === 'rejected') {
        const err: any = failed.reason;
        const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to regenerate SQL';
        return { success: false, message: msg, policies: [] };
      }

      const fulfilled = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value?.data ?? r.value);

      const anyBad = fulfilled.find((b) => String(b?.status).toUpperCase() !== 'SUCCESS');
      if (anyBad) {
        return {
          success: false,
          message: anyBad?.message ?? 'Regenerate failed',
          policies: [],
        };
      }

      return {
        success: true,
        message: 'Remediation SQL regenerated successfully',
        policies: [],
      };
    } catch (error: any) {
      console.error('Error regenerating remediation SQL:', error);
      return {
        success: false,
        message: error?.response?.data?.message ?? 'Failed to regenerate SQL',
        policies: [],
      };
    }
  },

  savePolicies: async (_request: SavePoliciesRequest): Promise<SavePoliciesResponse> => {
    // TODO: implement backend endpoint when available
    return { success: true, message: 'Policies saved successfully' };
  },

  approvePolicies: async (_request: ApprovePoliciesRequest): Promise<ApprovePoliciesResponse> => {
    // TODO: implement backend endpoint when available
    return { success: true, message: 'Policies approved successfully' };
  },
};

export const RemediationSQLAPI = {
  getPolicies: async (complianceId: string): Promise<GetPoliciesResponse> => {
    try {
      const url = `/api/remediation?regulationId=${encodeURIComponent(String(complianceId))}`;
      const resp: any = await apiClient.get(url);
      const body: any = unwrap<any>(resp);

      const payload = body?.items ? body : body?.data?.items ? body.data : body;
      const items = Array.isArray(payload?.items) ? payload.items : [];

      const policies: PolicyItem[] = items.map((raw: any, idx: number) => ({
        id: (raw.LOGICID ?? `${raw.POLICYID}-${idx}`) + '-' + idx,
        policyId: raw.POLICYID,
        policyDescription: raw.POLICYDESCRIPTION === null ? 'null' : (raw.POLICYDESCRIPTION ?? ''),
        remediationSQL: decodeHtmlEntities(raw.REMEDIATIONSQL ?? ''),
        commentsOnSQL: raw.COMMENTS ?? '',
        approvalStatus: raw.APPROVALSTATUS ?? '',
        selected: false,
        targetTable: raw.TARGETTABLE ?? '',
        targetTableColumns: raw.TARGETCOLUMN ?? '',
        citations: '',
        articleDisplay: '',
        comments: '',
      })) as PolicyItem[];

      return { success: true, message: 'Remediation SQL policies retrieved', policies };
    } catch (error: any) {
      console.error('Failed to fetch remediation SQL:', error);
      return { success: false, message: error?.message ?? 'Failed to fetch remediation SQL', policies: [] };
    }
  },

  scheduleJob: async (request: ScheduleJobRequest): Promise<ScheduleJobResponse> => {
    try {
      const url = `/api/schedules`;

      const dr: any = request.dateRange ?? {};
      const startRaw = dr.startDate ?? dr.start ?? dr.from ?? dr[0];
      const endRaw = dr.endDate ?? dr.end ?? dr.to ?? dr[1];

      const toISODate = (v: any) => {
        if (!v) return null;
        if (typeof v === 'string') return v;
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        if (typeof v?.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
        if (typeof v?.format === 'function') return v.format('YYYY-MM-DD');
        return String(v);
      };

      const startDate = toISODate(startRaw);
      const endDate = toISODate(endRaw);

      if (!request.frequency) {
        return { success: false, message: 'Frequency is required', data: null };
      }
      if (!startDate || !endDate) {
        return { success: false, message: 'Start date and end date are required', data: null };
      }

      const payload = {
        regulationId: Number(request.complianceId),
        frequency: request.frequency,
        startDate,
        endDate,
      };

      const resp: any = await apiClient.post(url, payload);
      const body: any = unwrap<any>(resp);
      console.log('Schedule job response body:', body);

      const apiSuccess = body?.success === true || String(body?.status).toUpperCase() === 'SUCCESS';
      const apiMessage = body?.message ?? 'Job scheduled successfully';
      const apiData = body?.data ?? null;

      return {
        success: apiSuccess,
        message: apiMessage,
        data: apiData,
      };
    } catch (error: any) {
      console.error('Error scheduling job:', error);
      return {
        success: false,
        message: error?.response?.data?.message ?? error?.message ?? 'Failed to schedule job',
        data: null,
      };
    }
  },
  
};

export const ScheduledJobsAPI = {
  getJobs: async (complianceId: string) => {
    try {
      const regulationId = toRegulationId(complianceId);
      const url = `/api/jobs/scheduled?regulationId=${encodeURIComponent(String(regulationId))}`;

      const resp: any = await apiClient.get(url);
      const body: any = unwrap<any>(resp);

      const rows = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const jobs = rows.map((r: any) => ({
        jobId: String(r.JOB_ID ?? ''),
        regulationId: String(r.REGULATION_ID ?? ''),
        startDate: String(r.START_DATE ?? ''),
        endDate: String(r.END_DATE ?? ''),
        frequency: String(r.FREQUENCY ?? ''),
        cronExpr: String(r.CRON_EXPR ?? ''),
        createdAt: String(r.CREATED_AT ?? ''),
        updatedAt: String(r.UPDATED_AT ?? ''),
      }));

      const apiSuccess =
        (typeof body?.success === 'boolean' ? body.success : true) &&
        jobs.length >= 0;

      const apiMessage =
        body?.message ??
        'Scheduled jobs retrieved successfully';

      console.log('[ScheduledJobsAPI] url:', url);
      console.log('[ScheduledJobsAPI] raw body:', body);
      console.log('[ScheduledJobsAPI] rows:', rows);
      console.log('[ScheduledJobsAPI] mapped jobs:', jobs);

      return {
        success: apiSuccess,
        message: apiMessage,
        jobs,
      };
    } catch (error: any) {
      console.log('[ScheduledJobsAPI] error:', error);
      return {
        success: false,
        message: error?.response?.data?.message ?? error?.message ?? 'Failed to fetch scheduled jobs',
        jobs: [],
      };
    }
  },
};
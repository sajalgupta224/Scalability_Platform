import { apiClient } from '../client';
import type {
  Chatbot as ChatbotEntity,
  ChatbotCreateRequest,
  ChatbotDeployRequest,
  ChatbotDeployResponse,
  ChatbotResponse as ChatbotResponseRow,
  ChatbotResponseObject,
  DeployedApplicationResponse,
  SaveChatbotResponse,
} from '../../types/chatbot';
 
/* -------------------- Shared DTOs for SQL endpoints -------------------- */
export interface ChatbotSQL {
  name: string;
  pipelineId: string;
  promptId: string;
  chatbotType: string;
  templateId: number;
  modelName: string;
  parentExperId: string | number | null;
}
 
export interface ChatbotSQLResponseRow {
  RESPONSE_ID: number;
  QUESTION: string;
  RESPONSE: string;
  START_TIME: string;
}
 
/* -------------------- Sanitizers -------------------- */
// Keep sanitization for legacy endpoints that build SQL strings server-side without binds.
const sanitizeChatbotCreate = (chatbot: ChatbotCreateRequest): ChatbotCreateRequest => {
  const sanitizeString = (value: string | string[]): string => {
    if (Array.isArray(value)) {
      return value.join(',').replace(/'/g, "''");
    }
    return value.replace(/'/g, "''");
  };

  return {
    name: sanitizeString(chatbot.name),
    pipelineId: sanitizeString(chatbot.pipelineId),
    promptId: sanitizeString(chatbot.promptId),
    chatbotType: sanitizeString(chatbot.chatbotType),
    templateId: chatbot.templateId,
    modelName: sanitizeString(chatbot.modelName),
    parentExperId: chatbot.parentExperId === null ? null : chatbot.parentExperId.toString(),
    userId: chatbot.userId,
  };
};
 
/* -------------------- Helpers used by TalkToDocument (REST to /api/*) -------------------- */
export interface SaveResponseResult {
  response_id: number | null;
  thinkingdesc_sent?: string | null;
  thinkingdesc_stored?: string | null;
  user_id_sent?: number | null;
  user_id_stored?: number | null;
}
 
async function saveResponseREST(args: {
  chatbotId: number;
  modelName: string;
  question: string;
  response: string;
  tokenCount?: number | null;
  userId?: number | null;
  thinking?: string | null;
 
  // Preferred structured SQL details object
  sqlDetails?: {
    sql?: string | null;
    queryId?: string | null;
    queryIdVerified?: boolean;
  } | null;
 
  // Optional fallback individual fields
  sqlText?: string | null;
  queryId?: string | null;
  queryIdVerified?: boolean;
}): Promise<SaveResponseResult> {
  const {
    chatbotId,
    modelName,
    question,
    response,
    tokenCount,
    userId = null,
    thinking = null,
 
    sqlDetails = null,
    sqlText = null,
    queryId = null,
    queryIdVerified = undefined,
  } = args;
 
  // IMPORTANT: do NOT escape here — backend uses binds to SP/INSERT
  const json = await apiClient.post<SaveResponseResult | SaveResponseResult[]>('/api/chatbot-response', {
    chatbot_id: chatbotId,
    model_name: modelName,
    question,
    response,
    token_count: tokenCount ?? response.length,
    user_id: userId,
    thinkingdesc: thinking ?? null,
 
    // SQL detail payloads
    sqlDetails: sqlDetails ?? undefined,
    sqlText: sqlText ?? (sqlDetails?.sql ?? undefined),
    queryId: queryId ?? (sqlDetails?.queryId ?? undefined),
    queryIdVerified:
      typeof queryIdVerified === 'boolean'
        ? queryIdVerified
        : (typeof sqlDetails?.queryIdVerified === 'boolean' ? sqlDetails.queryIdVerified : undefined),
  });
 
  // Backend wraps response in data array — unwrap if needed
  const result = Array.isArray(json) ? json[0] : json;
  return result ?? { response_id: null };
}
 
async function saveFeedbackREST(args: {
  responseId: number | null;
  chatbotId: number;
  rating01: 1 | 0;
  question: string;
  response: string;
  userId?: number | null;
  modelName?: string | null;
}): Promise<void> {
  await apiClient.post('/api/chatbot-feedback', {
    response_id: args.responseId ?? null,
    feedback_rating: args.rating01,
    user_id: args.userId ?? null,
    chatbot_id: args.chatbotId,
    question: args.question,
    response: args.response,
    model_name: args.modelName ?? null,
  });
}
 
/* -------------------- REST suite (/chatbots/*) -------------------- */
export const ChatbotAPI = {
  createChatbot: async (chatbotObj: ChatbotCreateRequest): Promise<SaveChatbotResponse[]> => {
    const chatbot = sanitizeChatbotCreate(chatbotObj);
    return apiClient.post<SaveChatbotResponse[]>('/chatbots/create', chatbot);
  },
 
  getResponses: async (chatbotId: number): Promise<ChatbotResponseRow[]> => {
    return apiClient.get<ChatbotResponseRow[]>(`/chatbots/${chatbotId}/history`);
  },
 
  deployChatbot: async (chatbot: ChatbotDeployRequest): Promise<ChatbotDeployResponse> => {
    return apiClient.post<ChatbotDeployResponse>('/chatbots/deploy', chatbot);
  },
 
  getPipelines: async (): Promise<any[]> => {
    return apiClient.get<any[]>('/pipelines');
  },
 
  getPrompts: async (): Promise<any[]> => {
    return apiClient.get<any[]>('/prompts');
  },
 
  getDeployedApplications: async (): Promise<DeployedApplicationResponse[]> => {
    return apiClient.get<DeployedApplicationResponse[]>('/chatbots/deployments');
  },
 
  getChatbots: async (): Promise<ChatbotEntity[]> => {
    return apiClient.get<ChatbotEntity[]>('/chatbots');
  },
 
  getChatbotById: async (id: number): Promise<ChatbotEntity> => {
    return apiClient.get<ChatbotEntity>(`/chatbots/${id}`);
  },
 
  // legacy path (no sql_details)
  saveChatbotResponse: async (chatbotResponseObject: ChatbotResponseObject): Promise<void> => {
    const { chatbotId, modelName, question, response, userId, tokenCount } = chatbotResponseObject;
    const payload = {
      chatbot_id: chatbotId,
      model_name: modelName,
      question,
      response,
      token_count: tokenCount ?? response.length,
      user_id: userId ?? null,
    };
    await apiClient.post('/chatbots/response', payload);
  },
 
  saveResponseREST,
  saveFeedbackREST,
}; 
 
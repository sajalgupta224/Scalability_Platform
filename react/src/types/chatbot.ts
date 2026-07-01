// Chatbot types based on API responses

export interface Chatbot {
  CHATBOT_ID: number;
  CHATBOT_NAME: string;
  PIPELINE_ID: string;
  PROMPT_ID: string | number | null;
  CREATED_AT: string;
  CHATBOT_TYPE: string;
  TEMPLATE_ID: number;
  APP_MODEL_NAME: string | null;
  PARENT_EXPER_ID: string | null;
  USER_ID: number | null;
}

export interface Pipeline {
  PIPELINE_ID: number;
  PIPELINE_NAME: string;
  DATA_SOURCE: string;
  STAGE_NAME: string | null;
  SELECTED_FILE: string;
  DATABASE_NAME: string;
  SCHEMA_NAME: string;
  TABLE_NAME: string;
  UPLOADED_FILE: string;
  CHUNKING_METHOD: string;
  MODE: string;
}

export interface Prompt {
  PROMPT_ID: number;
  NAME: string;
  USER_DESCRIPTION: string;
  GENERATED_PROMPT: string;
  DOMAIN: string;
  PROMPTING_TYPE: string;
}

// Options for dropdowns/selection
export interface ChatbotOption {
  id: string;
  name: string;
  pipelineId?: string;
  templateId?: number;
  imageUrl?: string;
  description?: string;
}

export interface PipelineOption {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
}

export interface PromptOption {
  id: string;
  name: string;
}

// Form data types
export interface ChatbotFormData {
  chatbotName: string;
  pipelineId: string;
  promptId?: string;
  modelIds?: string[];
}

// API Request/Response types
/**
 * Chatbot creation request payload
 */
export interface ChatbotCreateRequest {
  name: string;
  pipelineId: string;
  promptId: string;
  chatbotType: string;
  templateId: number;
  modelName: string | string[];
  parentExperId: string | number | null;
  userId: number | string;
}

/**
 * Chatbot creation response
 */
export interface SaveChatbotResponse {
  chatbotId: number;
  name: string;
  pipelineId: string;
  promptId: string | null;
  chatbotType: string;
  templateId: number;
  models: string[];
}

/**
 * Chatbot response history item
 */
export interface ChatbotResponse {
  RESPONSE_ID: number;
  CHATBOT_ID: number;
  USER_ID: number | null;
  MODEL_NAME: string;
  USER_MESSAGE: string;
  BOT_MESSAGE: string;
  THINKINGDESC: string | null;
  TOKEN_COUNT: number;
  START_TIME: string;
  END_TIME: string;
  CREATED_AT: string;
}

/**
 * Chatbot deployment request payload
 */
export interface ChatbotDeployRequest {
  chatbotId: number;
  chatbotName: string;
  chatbotType: string;
  model: string;
  roles: string[];
  pipelineName: string;
  deployedBy: string;
}

/**
 * Chatbot deployment response
 */
export interface ChatbotDeployResponse {
  chatbotName: string;
  chatbotType: string;
  deployedBy: string;
  model: string;
  pipelineName: string;
  roles: string;
}

/**
 * Deployed application API response
 */
export interface DeployedApplicationResponse {
  CHATBOT_ID?: number;
  ID?: number;
  CHATBOT_NAME?: string;
  NAME?: string;
}

/**
 * Chatbot response save request payload
 */
export interface ChatbotResponseObject {
  chatbotId: number;
  modelName: string;
  question: string;
  response: string;
  tokenCount?: number | null;
  userId?: number | null;
}

// View types
export type ChatbotView = 'search' | 'create';

// Context type
export interface ChatbotContextType {
  // Single chatbot state
  chatbot: Chatbot | null;
  setChatbot: (chatbot: Chatbot | null) => void;

  // Pipeline and Prompt states
  pipeline: Pipeline | null;
  setPipeline: (pipeline: Pipeline | null) => void;
  prompt: Prompt | null;
  setPrompt: (prompt: Prompt | null) => void;

  // Available options for selection
  availableChatbots: ChatbotOption[];
  pipelines: PipelineOption[];
  prompts: PromptOption[];

  // Loading states
  isLoadingChatbots: boolean;
  isLoadingPipelines: boolean;
  isLoadingPrompts: boolean;

  // Error states
  chatbotsError: string | null;
  pipelinesError: string | null;
  promptsError: string | null;

  // Actions
  createChatbot: (chatbotData: ChatbotFormData) => Promise<string>;
  fetchChatbotById: (id: number) => Promise<void>;
  fetchPipelineById: (id: string | number) => Promise<void>;
  fetchPromptById: (id: number) => Promise<void>;
  selectChatbot: (chatbot: ChatbotOption) => void;
  updateChatbotPipeline: (pipelineId: string) => void;
  updateChatbotName: (name: string) => void;
  clearChatbotData: () => void;
  refreshChatbots: () => Promise<void>;
  refreshPipelines: () => Promise<void>;
  refreshPrompts: () => Promise<void>;
}

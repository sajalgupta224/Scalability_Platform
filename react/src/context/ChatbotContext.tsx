import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { ChatbotAPI } from '../api/endpoints/chatbot.api';
import { PipelineAPI } from '../api/endpoints/pipeline.api';
import { PromptsAPI } from '../api/endpoints/prompts.api';
import { useAppContext } from './AppContext';
import type {
  ChatbotContextType,
  Chatbot,
  Pipeline,
  Prompt,
  ChatbotOption,
  PipelineOption,
  PromptOption,
  ChatbotFormData,
} from '../types/chatbot';

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

// Storage key for persistence
const STORAGE_KEY = 'raise_chatbot_data';

// Map mode to chatbot type camelCase string
const getChatbotType = (mode: 'TalkToDocument' | 'TalkToData'): string => {
  switch (mode) {
    case 'TalkToDocument':
      return 'talkToDocument';
    case 'TalkToData':
      return 'talkToData';
    default:
      return 'chatbot_app';
  }
};

// Default values for chatbot creation (excluding chatbotType which depends on mode)
const chatbotDefaultValues = {
  parentExperId: null,
  templateId: 1,
};

export const ChatbotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, mode } = useAppContext();

  // Single chatbot state
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  // Available options for selectors
  const [availableChatbots, setAvailableChatbots] = useState<ChatbotOption[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [prompts, setPrompts] = useState<PromptOption[]>([]);

  // Loading states
  const [isLoadingChatbots, setIsLoadingChatbots] = useState(false);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);

  // Error states
  const [chatbotsError, setChatbotsError] = useState<string | null>(null);
  const [pipelinesError, setPipelinesError] = useState<string | null>(null);
  const [promptsError, setPromptsError] = useState<string | null>(null);

  // Load from localStorage on mount TODO
  // useEffect(() => {
  //   try {
  //     const stored = localStorage.getItem(STORAGE_KEY);
  //     if (stored) {
  //       const data = JSON.parse(stored);
  //       if (data.chatbot) {
  //         setChatbot(data.chatbot);
  //       }
  //       if (data.pipeline) {
  //         setPipeline(data.pipeline);
  //       }
  //       if (data.prompt) {
  //         setPrompt(data.prompt);
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error loading chatbot data from localStorage:', error);
  //   }
  // }, []);

  // Save to localStorage whenever chatbot data changes TODO
  // useEffect(() => {
  //   if (chatbot) {
  //     try {
  //       localStorage.setItem(STORAGE_KEY, JSON.stringify({
  //         chatbot,
  //         pipeline,
  //         prompt,
  //       }));
  //     } catch (error) {
  //       console.error('Error saving chatbot data to localStorage:', error);
  //     }
  //   }
  // }, [chatbot, pipeline, prompt]);

  // Fetch chatbots from API
  const refreshChatbots = useCallback(async () => {
    setIsLoadingChatbots(true);
    setChatbotsError(null);
    try {
      const chatbots = await ChatbotAPI.getChatbots();
      const chatbotsList: ChatbotOption[] = chatbots.map((item: Chatbot) => ({
        id: item.CHATBOT_ID.toString(),
        name: item.CHATBOT_NAME,
        pipelineId: item.PIPELINE_ID,
        templateId: item.TEMPLATE_ID,
      }));
      setAvailableChatbots(chatbotsList);
    } catch (err) {
      console.error('Error fetching chatbots:', err);
      setChatbotsError('Failed to load chatbots');
      setAvailableChatbots([]);
    } finally {
      setIsLoadingChatbots(false);
    }
  }, []);

  // Fetch pipelines from API using new endpoint
  const refreshPipelines = useCallback(async () => {
    setIsLoadingPipelines(true);
    setPipelinesError(null);
    try {
      const pipelines = await PipelineAPI.getPipelines();
      if (import.meta.env.MODE === 'development') console.debug('refreshPipelines raw:', pipelines);
      const pipelinesList: PipelineOption[] = (pipelines || [])
        .map((item: any) => {
          const rawId = item?.PIPELINE_ID ?? item?.pipeline_id ?? item?.pipelineId ?? item?.id ?? null;
          const rawName = item?.PIPELINE_NAME ?? item?.pipeline_name ?? item?.pipelineName ?? item?.name ?? '';
          return rawId ? { id: String(rawId), name: rawName || String(rawId) } : null;
        })
        .filter(Boolean) as PipelineOption[];
      setPipelines(pipelinesList);
    } catch (err) {
      console.error('Error fetching pipelines:', err);
      setPipelinesError('Failed to load pipelines');
      setPipelines([]);
    } finally {
      setIsLoadingPipelines(false);
    }
  }, []);

  // Fetch prompts from API using new endpoint
  const refreshPrompts = useCallback(async () => {
    setIsLoadingPrompts(true);
    setPromptsError(null);
    try {
      const prompts = await PromptsAPI.getPrompts();
      const promptsList: PromptOption[] = prompts.map((item) => ({
        id: item.PROMPT_ID.toString(),
        name: item.NAME,
      }));
      setPrompts(promptsList);
    } catch (err) {
      console.error('Error fetching prompts:', err);
      setPromptsError('Failed to load prompts');
      setPrompts([]);
    } finally {
      setIsLoadingPrompts(false);
    }
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    refreshChatbots();
    refreshPipelines();
    refreshPrompts();
  }, [refreshChatbots, refreshPipelines, refreshPrompts]);

  const createChatbot = async (chatbotData: ChatbotFormData): Promise<string> => {
    try {
      const userId = currentUser?.USERID || '';
      const modelName = chatbotData.modelIds && chatbotData.modelIds.length > 0
        ? chatbotData.modelIds
        : ['mistral-large2'];
      const payload = {
        name: chatbotData.chatbotName,
        pipelineId: chatbotData.pipelineId,
        promptId: chatbotData.promptId || '',
        userId,
        chatbotType: getChatbotType(mode),
        modelName,
        ...chatbotDefaultValues
      };

      const res = await ChatbotAPI.createChatbot(payload);
      const id = res?.chatbotId;

      if (id) {
        await fetchChatbotById(id);
        // Refresh chatbot list to include the new one
        await refreshChatbots();
        return id.toString();
      } else {
        throw new Error('Failed to get chatbot ID from response');
      }
    } catch (error) {
      console.error('Error creating chatbot:', error);
      throw error;
    }
  };

  // Fetch chatbot by ID using new endpoint
  const fetchChatbotById = async (id: number) => {
    try {
      const chatbotData = await ChatbotAPI.getChatbotById(id);
      setChatbot(chatbotData);

      // Automatically fetch related pipeline and prompt if IDs exist
      if (chatbotData.PIPELINE_ID) {
        await fetchPipelineById(chatbotData.PIPELINE_ID);
      }
      if (chatbotData.PROMPT_ID) {
        await fetchPromptById(Number(chatbotData.PROMPT_ID));
      }
    } catch (error) {
      console.error('Error fetching chatbot:', error);
      throw error;
    }
  };

  // Fetch pipeline by ID using new endpoint
  const fetchPipelineById = async (id: string | number) => {
    try {
      const pipelineData = await PipelineAPI.getPipelineById(id);
      setPipeline(pipelineData);
    } catch (error) {
      console.error('Error fetching pipeline:', error);
      throw error;
    }
  };

  // Fetch prompt by ID using new endpoint
  const fetchPromptById = async (id: number) => {
    try {
      const promptData = await PromptsAPI.getPromptById(id);
      setPrompt(promptData);
    } catch (error) {
      console.error('Error fetching prompt:', error);
      throw error;
    }
  };

  const selectChatbot = useCallback(async (chatbotOption: ChatbotOption) => {
    // Fetch full chatbot data by ID
    await fetchChatbotById(Number(chatbotOption.id));
  }, []);

  const updateChatbotPipeline = useCallback(async (pipelineId: string) => {
    // Update pipeline in current chatbot and fetch pipeline details
    if (chatbot) {
      setChatbot({
        ...chatbot,
        PIPELINE_ID: pipelineId,
      });
      await fetchPipelineById(pipelineId);
    }
  }, [chatbot]);

  const updateChatbotName = useCallback((name: string) => {
    // Update chatbot name in current chatbot
    if (chatbot) {
      setChatbot({
        ...chatbot,
        CHATBOT_NAME: name,
      });
    }
  }, [chatbot]);

  const clearChatbotData = useCallback(() => {
    setChatbot(null);
    setPipeline(null);
    setPrompt(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: ChatbotContextType = {
    chatbot,
    setChatbot,
    pipeline,
    setPipeline,
    prompt,
    setPrompt,
    availableChatbots,
    pipelines,
    prompts,
    isLoadingChatbots,
    isLoadingPipelines,
    isLoadingPrompts,
    chatbotsError,
    pipelinesError,
    promptsError,
    createChatbot,
    fetchChatbotById,
    fetchPipelineById,
    fetchPromptById,
    selectChatbot,
    updateChatbotPipeline,
    updateChatbotName,
    clearChatbotData,
    refreshChatbots,
    refreshPipelines,
    refreshPrompts,
  };

  return <ChatbotContext.Provider value={value}>{children}</ChatbotContext.Provider>;
};

export const useChatbot = (): ChatbotContextType => {
  const context = useContext(ChatbotContext);
  if (!context) {
    // During development, this might happen during hot reload
    if (import.meta.env.MODE === 'development') {
      console.warn('useChatbot called outside ChatbotProvider context');
    }
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};

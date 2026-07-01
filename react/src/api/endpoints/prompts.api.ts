import { apiClient } from '../client';
import type { Prompt } from '../../types/chatbot';
import type { PromptData } from '../../types/prompts.types';

export const PromptsAPI = {
  getPrompts: async (): Promise<PromptData[]> => {
    return apiClient.get<PromptData[]>('/prompts');
  },

  getPromptById: async (id: number): Promise<Prompt> => {
    return apiClient.get<Prompt>(`/prompts/${id}`);
  },
};

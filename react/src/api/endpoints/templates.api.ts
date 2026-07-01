
import { apiClient } from "../client";
import type { Template, RegisterTemplatePayload } from "../../types/templates.types";

export const TemplatesAPI = {
  getTemplates: async (): Promise<Template[]> => {
    return apiClient.get<Template[]>("/api/templates");
  },

  registerTemplate: async (
    payload: RegisterTemplatePayload
  ): Promise<Template> => {
    return apiClient.post<Template, RegisterTemplatePayload>(
      "/api/templates",
      payload
    );
  },
};

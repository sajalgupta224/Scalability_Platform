
import { apiClient } from "../client";

export type CreateSearchServiceRequest = {
  db: string;
  schema: string;
  table: string;
  textColumn: string;
  attributeColumns?: string[];
  serviceName: string;
  filter?: string;
};

export type CreateSearchServiceResponse = {
  ok: boolean;
  message: string;
  generatedSQL?: string;
  error?: string;
};

export const SearchServiceAPI = {
  create: async (payload: CreateSearchServiceRequest): Promise<CreateSearchServiceResponse> => {
    return apiClient.post<CreateSearchServiceResponse>("/api/create-search-service", payload);
  },
};

// src/api/endpoints/semanticView.api.ts
import { apiClient } from "../client";
import api from "../index";

// dev baseURL = http://localhost:5000 (axios instance)
// prod baseURL = /api
// avoid /api/api duplication:
const API_PREFIX = import.meta.env.MODE === "development" ? "/api" : "";

export const SemanticViewAPI = {
  getDatabases: async (): Promise<string[]> => {
    return apiClient.get<string[]>(`${API_PREFIX}/databases`);
  },

  getSchemas: async (db: string): Promise<string[]> => {
    return apiClient.get<string[]>(`${API_PREFIX}/schemas`, { params: { db } });
  },

  getTablesBySchema: async (db: string, schema: string): Promise<string[]> => {
    return apiClient.get<string[]>(`${API_PREFIX}/tables`, { params: { db, schema } });
  },

   getSemanticViews: async (): Promise<string[]> => {
   const response = await api.get<string[]>(`${API_PREFIX}/semantic-views`);
   return response.data;
  },
  // fetching the views from backend
  getViewsBySchema: async (db: string, schema: string): Promise<string[]> => {
    const response = await api.get<string[]>(`${API_PREFIX}/views`, { params: { db, schema } });
    return response.data;
  },

  // NEW: fetch semantic models for a given database + schema
  getSemanticModels: async (db: string, schema: string): Promise<string[]> => {
    const response = await api.get<string[]>(`${API_PREFIX}/semantic-models`, { params: { db, schema } });
    return response.data;
  },

  /**
   * ✅ SQL Generation (POST /api/semantic-model)
   * Backend response: { success:true, data:{ sql:"..." }, message:"..." }
   * apiClient returns only `data`, so we receive { sql: string }
   */
  generateSql: async (body: {
    modelName: string;
    database: string;
    schema: string;
    tables: string[];
  }): Promise<{ sql: string }> => {
    return apiClient.post<{ sql: string }>(`${API_PREFIX}/semantic-model`, body);
  },
};

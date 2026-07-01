
import { apiClient } from '../client';

export const MetadataAPI = {
  getTables: async (db: string, schema: string): Promise<string[]> => {
    return apiClient.get<string[]>('/api/tables', { params: { db, schema } });
  },

  getColumns: async (db: string, schema: string, table: string): Promise<string[]> => {
    return apiClient.get<string[]>('/api/columns', { params: { db, schema, table } });
  },
};

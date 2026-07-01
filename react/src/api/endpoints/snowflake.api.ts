import { apiClient } from '../client';
import type { UserData } from '../../types/common';
import type { RoleData, CostHistoryItem } from '../../types/snowflake.types';

export const SnowflakeAPI = {
  getCurrentUser: async (): Promise<UserData> => {
    return apiClient.get<UserData>('/snowflake/current-user');
  },

  getRoles: async (): Promise<RoleData[]> => {
    return apiClient.get<RoleData[]>('/snowflake/roles');
  },

  getCostHistory: async (startDate: string, endDate: string): Promise<CostHistoryItem[]> => {
    return apiClient.get<CostHistoryItem[]>(
      `/snowflake/container-services/history?startDate=${startDate}&endDate=${endDate}`
    );
  },
};

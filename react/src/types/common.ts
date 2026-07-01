/**
 * User data entity
 */
export interface UserData {
  USERID: number;
  USERNAME: string;
  LOGINNAME: string;
  EMAIL: string;
}

// ApiResponse moved to api.types.ts
// Import it from there: import { ApiResponse } from './api.types';
// Re-export for backward compatibility
export type { ApiResponse } from './api.types';

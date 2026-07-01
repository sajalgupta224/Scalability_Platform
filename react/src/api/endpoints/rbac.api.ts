import { apiClient } from "../client";

export type CurrentRoleData = {
  current_role: string | null;
};

export type PermissionRow = {
  ROLE_NAME: string;
  PAGE_NAME: string;
  HAS_ACCESS: boolean | number | string;
};

export type UpdatePermissionPayload = {
  role_name: string;
  page_name: string;
  has_access: boolean;
};

export type UsersWithRoleData = {
  users: { USER_NAME: string; ROLE: string }[];
};

const toBool = (v: any) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return false;
};

export const RbacAPI = {
  getCurrentRole: async (): Promise<CurrentRoleData> => {
    return apiClient.get<CurrentRoleData>("/api/current-role");
  },

  getPermissions: async (): Promise<PermissionRow[]> => {
    const resp = await apiClient.get<{ access: PermissionRow[] }>(
      "/api/current-access"
    );

    const rows = resp?.access || [];
    return rows.map((r) => ({
      ...r,
      HAS_ACCESS: toBool(r.HAS_ACCESS),
    }));
  },

  updatePermission: async (payload: UpdatePermissionPayload) => {
    return apiClient.post<
      { success: boolean; updated: any },
      UpdatePermissionPayload
    >("/api/role-permissions/update", payload, {
      headers: { "Content-Type": "application/json" },
    });
  },

  getUsersWithRole: async (): Promise<UsersWithRoleData> => {
    return apiClient.get<UsersWithRoleData>("/api/currentUserWithRole");
  },
};

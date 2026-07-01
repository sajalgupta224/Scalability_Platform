import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SnowflakeAPI } from "../api/endpoints/snowflake.api";
import { RbacAPI } from "../api/endpoints/rbac.api";
import type { UserData } from "../types/common";
import type { PermissionRow } from "../api/endpoints/rbac.api";
import { RBAC_PAGES } from "../constants/rbacPages";
 
export type Mode = "TalkToDocument" | "TalkToData";
 
interface AppContextProps {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
 
  currentUser: UserData | null;
  isLoadingUser: boolean;
  userError: string | null;
 
  mode: Mode;
  setMode: (mode: Mode) => void;
 
  currentRole: string | null;
  loadingRole: boolean;
 
  permissions: Record<string, boolean>;
 
  permissionRows: PermissionRow[];
  effectiveRole: string | null;
  setEffectiveRole: (role: string | null) => void;
  effectivePermissions: Record<string, boolean>;
 
  refreshRoleAndPermissions: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}
 
const AppContext = createContext<AppContextProps | undefined>(undefined);
 
const normalize = (v: string | null | undefined) => (v || "").trim().toLowerCase();
const cleanPage = (v: string | null | undefined) => (v || "").trim();
 
const buildPermissionMapForRole = (rows: PermissionRow[], roleName: string | null) => {
  const map: Record<string, boolean> = {};
  if (!roleName) return map;
 
  const role = normalize(roleName);
 
  rows
    .filter((r) => normalize(r.ROLE_NAME) === role)
    .forEach((r) => {
      // ✅ Trim PAGE_NAME to avoid space mismatch issues
      map[cleanPage(r.PAGE_NAME)] = Boolean(r.HAS_ACCESS);
    });
 
  return map;
};
 
const isAdminRole = (role: string | null) => normalize(role) === "x_in_capg_poc_rwcx_ai_scalability_sol"; // "raise_admin"
 
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
 
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
 
  const [mode, setMode] = useState<Mode>("TalkToDocument");
 
  // ✅ RBAC state
  const [currentRole, setCurrentRole] = useState<string | null>("");
  const [loadingRole, setLoadingRole] = useState(true);
 
  // ✅ permissions map for current logged-in role
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
 
  // ✅ store all RBAC rows (so we can compute for any role)
  const [permissionRows, setPermissionRows] = useState<PermissionRow[]>([]);
 
  // ✅ preview role (admin only) persisted in localStorage
  const [effectiveRole, _setEffectiveRole] = useState<string | null>(() => {
    const v = localStorage.getItem("rbacPreviewRole");
    return v ? v : null;
  });
 
  const setEffectiveRole = (role: string | null) => {
    _setEffectiveRole(role);
    if (role) localStorage.setItem("rbacPreviewRole", role);
    else localStorage.removeItem("rbacPreviewRole");
  };
 
  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);
 
  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      setIsLoadingUser(true);
      setUserError(null);
      try {
        const userData = await SnowflakeAPI.getCurrentUser();
        setCurrentUser(userData);
      } catch (err) {
        console.error("Error fetching current user:", err);
        setUserError("Failed to fetch current user");
      } finally {
        setIsLoadingUser(false);
      }
    };
 
    fetchCurrentUser();
  }, []);
 
  const refreshPermissions = async () => {
    const rows = await RbacAPI.getPermissions();
    setPermissionRows(rows);
    setPermissions(buildPermissionMapForRole(rows, currentRole));
  };
 
  const refreshRoleAndPermissions = async () => {
    setLoadingRole(true);
    try {
      const roleResp = await RbacAPI.getCurrentRole();
      const role = roleResp?.current_role || null;
      console.log("Current Role:", role);
      setCurrentRole(role);
 
      const rows = await RbacAPI.getPermissions();
      setPermissionRows(rows);
      setPermissions(buildPermissionMapForRole(rows, role));
    } catch (err) {
      console.error("Error fetching RBAC:", err);
      setCurrentRole(null);
      setPermissionRows([]);
      setPermissions({});
    } finally {
      setLoadingRole(false);
    }
  };
 
  useEffect(() => {
    refreshRoleAndPermissions();
  }, []);
 
  /**
   * ✅ Effective role resolution:
   * - If admin chose preview role => use that for UI filtering
   * - Else use currentRole
   */
  const resolvedEffectiveRole = useMemo(() => {
    if (isAdminRole(currentRole) && effectiveRole) return effectiveRole;
    return currentRole;
  }, [currentRole, effectiveRole]);
 
  /**
   * ✅ Effective permissions based on resolvedEffectiveRole
   * Admin role gets all pages enabled regardless of DB rows
   */
  const effectivePermissions = useMemo(() => {
    if (isAdminRole(currentRole) && !effectiveRole) {
      // Admin with no preview role: grant access to everything
      const allTrue: Record<string, boolean> = {};
      RBAC_PAGES.forEach((p) => { allTrue[p] = true; });
      return allTrue;
    }
    return buildPermissionMapForRole(permissionRows, resolvedEffectiveRole);
  }, [permissionRows, resolvedEffectiveRole, currentRole, effectiveRole]);
 
  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
 
      currentUser,
      isLoadingUser,
      userError,
 
      mode,
      setMode,
 
      currentRole,
      loadingRole,
      permissions,
 
      permissionRows,
      effectiveRole,
      setEffectiveRole,
      effectivePermissions,
 
      refreshRoleAndPermissions,
      refreshPermissions,
    }),
    [
      sidebarCollapsed,
      currentUser,
      isLoadingUser,
      userError,
      mode,
      currentRole,
      loadingRole,
      permissions,
      permissionRows,
      effectiveRole,
      effectivePermissions,
    ]
  );
 
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
 
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
 
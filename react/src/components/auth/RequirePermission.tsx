import React from "react";
import { Navigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { canAccess } from "../../utils/rbacAccess";

type RequirePermissionProps = {
  page: string;
  parent?: string;
  children: React.ReactNode;
};

const RequirePermission: React.FC<RequirePermissionProps> = ({ page, parent, children }) => {
  const {
    loadingRole,
    currentRole,
    effectiveRole,          // ✅ preview role (admin can simulate)
    effectivePermissions,   // ✅ permissions computed for effectiveRole
  } = useAppContext();

  if (loadingRole) return null;

  // ✅ In preview mode, use preview role. Else use current role.
  const roleForCheck = effectiveRole || currentRole;

  const allowed = canAccess(effectivePermissions, roleForCheck, page, parent);

  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default RequirePermission;
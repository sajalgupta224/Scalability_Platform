export const isAdminRole = (role?: string | null) =>
  (role || "").trim().toLowerCase() === "raise_admin";

export const canAccess = (
  permissions: Record<string, boolean | undefined>,
  currentRole: string | null,
  childKey: string,
  parentKey?: string
) => {
  // ✅ NOTE: admin bypass only when role really is admin
  if (isAdminRole(currentRole)) return true;

  const child = (childKey || "").trim();
  const parent = (parentKey || "").trim();

  if (
    parent &&
    Object.prototype.hasOwnProperty.call(permissions, parent) &&
    permissions[parent] === false
  ) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(permissions, child)) {
    return Boolean(permissions[child]);
  }

  if (parent && Object.prototype.hasOwnProperty.call(permissions, parent)) {
    return Boolean(permissions[parent]);
  }

  return false;
};
import { AppRole } from "@/types/database.types";
import { Permission, UserSessionProfile } from "@/types/rbac.types";
import { getPermissionsForRole } from "./permissions";

export function userHasRole(userRole: AppRole, requiredRole: AppRole): boolean {
  if (userRole === "super_admin") return true;
  return userRole === requiredRole;
}

export function userHasPermission(userRole: AppRole, requiredPermission: Permission): boolean {
  const permissions = getPermissionsForRole(userRole);
  return permissions.includes(requiredPermission);
}

export function assertAuthorization(
  user: UserSessionProfile,
  requiredPermission: Permission
): void {
  if (!userHasPermission(user.role, requiredPermission)) {
    throw new Error(`Forbidden: User '${user.fullName}' lacks '${requiredPermission}' permission.`);
  }
}

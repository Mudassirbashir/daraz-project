import { AppRole } from "./database.types";

export type Permission =
  | "product_dev:read"
  | "product_dev:write"
  | "vendors:read"
  | "vendors:write"
  | "stores:read"
  | "stores:write"
  | "listings:read"
  | "listings:write"
  | "inventory:read"
  | "inventory:write"
  | "orders:read"
  | "orders:write"
  | "tasks:read"
  | "tasks:write"
  | "finance:read"
  | "finance:write"
  | "sync:read"
  | "sync:execute"
  | "admin:full";

export interface UserSessionProfile {
  id: string;
  email: string;
  fullName: string;
  employeeId: string;
  role: AppRole;
  permissions: Permission[];
}

export interface RouteRoleGuard {
  pathPrefix: string;
  allowedRoles: AppRole[];
  requiredPermissions?: Permission[];
}

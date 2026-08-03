import { AppRole } from "@/types/database.types";
import { Permission, RouteRoleGuard } from "@/types/rbac.types";

export const ROLE_PERMISSIONS_MAP: Record<AppRole, Permission[]> = {
  super_admin: [
    "product_dev:read",
    "product_dev:write",
    "vendors:read",
    "vendors:write",
    "stores:read",
    "stores:write",
    "listings:read",
    "listings:write",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "orders:write",
    "tasks:read",
    "tasks:write",
    "finance:read",
    "finance:write",
    "sync:read",
    "sync:execute",
    "admin:full",
  ],
  product_manager: [
    "product_dev:read",
    "product_dev:write",
    "vendors:read",
    "vendors:write",
    "stores:read",
    "listings:read",
    "listings:write",
    "inventory:read",
    "orders:read",
    "tasks:read",
    "tasks:write",
    "finance:read",
    "sync:read",
  ],
  ops_manager: [
    "product_dev:read",
    "vendors:read",
    "stores:read",
    "listings:read",
    "listings:write",
    "inventory:read",
    "inventory:write",
    "orders:read",
    "orders:write",
    "tasks:read",
    "tasks:write",
    "finance:read",
    "sync:read",
    "sync:execute",
  ],
};

export const PROTECTED_ROUTES: RouteRoleGuard[] = [
  {
    pathPrefix: "/admin",
    allowedRoles: ["super_admin"],
  },
  {
    pathPrefix: "/finance",
    allowedRoles: ["super_admin"],
  },
  {
    pathPrefix: "/product-dev",
    allowedRoles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    pathPrefix: "/vendors",
    allowedRoles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    pathPrefix: "/stores",
    allowedRoles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    pathPrefix: "/listings",
    allowedRoles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    pathPrefix: "/inventory",
    allowedRoles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    pathPrefix: "/orders",
    allowedRoles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    pathPrefix: "/tasks",
    allowedRoles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    pathPrefix: "/sync",
    allowedRoles: ["super_admin", "ops_manager"],
  },
];

export function getPermissionsForRole(role: AppRole): Permission[] {
  return ROLE_PERMISSIONS_MAP[role] || [];
}

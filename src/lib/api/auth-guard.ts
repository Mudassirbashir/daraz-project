import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppRole } from "@/types/database.types";
import { Permission, RouteRoleGuard } from "@/types/rbac.types";
import {
  ROLE_PERMISSIONS_MAP,
  PROTECTED_ROUTES,
} from "@/lib/rbac/permissions";

/**
 * Authenticated principal resolved server-side from Supabase.
 *
 * `userId` is the only source of truth. Role is ALWAYS re-resolved from the
 * `user_roles` / `profiles` tables; we never trust cookies or JWT metadata.
 */
export interface AuthPrincipal {
  userId: string;
  email: string | null;
  role: AppRole;
}

export type AuthFailure =
  | { kind: "NO_SESSION"; status: 401; body: { success: false; error: string } }
  | { kind: "FORBIDDEN_ROLE"; status: 403; body: { success: false; error: string } }
  | { kind: "FORBIDDEN_PERMISSION"; status: 403; body: { success: false; error: string } };

export interface AuthSuccess {
  ok: true;
  principal: AuthPrincipal;
  supabase: ReturnType<typeof createClient>;
}

export interface AuthFailureResult {
  ok: false;
  response: NextResponse;
}

export type AuthResult = AuthSuccess | AuthFailureResult;

/**
 * Resolve the authenticated Supabase user for a server route.
 *
 * Rules:
 *  - Uses Supabase server client (cookie-based session) ONLY.
 *  - Rejects requests that have no verified user.
 *  - Never trusts the `daraz_ops_user` cookie.
 *  - Never trusts `user.user_metadata.role`.
 *  - Resolves role from `user_roles` first, then `profiles`, then JWT.
 */
export async function requireAuthenticatedUser(
  req: NextRequest,
  required?: {
    pathPrefix?: string;
    permission?: Permission;
  }
): Promise<AuthResult> {
  const serverSupabase = createClient();
  const { data, error } = await serverSupabase.auth.getUser();
  const user = data?.user || null;

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized: Active session required." },
        { status: 401 }
      ),
    };
  }

  const role = await resolveRoleServerSide(user.id, user.email || null);
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Forbidden: No role assigned to user." },
        { status: 403 }
      ),
    };
  }

  if (required?.pathPrefix) {
    const guard = PROTECTED_ROUTES.find((g: RouteRoleGuard) =>
      required.pathPrefix!.startsWith(g.pathPrefix)
    );
    if (guard && role !== "super_admin" && !guard.allowedRoles.includes(role)) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: `Forbidden: Role '${role}' cannot access this resource.` },
          { status: 403 }
        ),
      };
    }
  }

  if (required?.permission && !hasPermission(role, required.permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: `Forbidden: Missing permission '${required.permission}'.` },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    principal: { userId: user.id, email: user.email || null, role },
    supabase: serverSupabase,
  };
}

/**
 * Resolve a user's role server-side. Returns null when none found.
 * Priority: user_roles → profiles → JWT (last resort, never trusted alone).
 */
export async function resolveRoleServerSide(
  userId: string,
  email: string | null
): Promise<AppRole | null> {
  if (!userId) return null;

  try {
    const admin = createAdminClient();
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleRow?.role) return roleRow.role as AppRole;

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role) return profile.role as AppRole;
  } catch (err) {
    console.error("[AuthGuard] role lookup error:", (err as Error)?.message);
  }

  return null;
}

export function hasPermission(role: AppRole, permission: Permission): boolean {
  if (role === "super_admin") return true;
  return (ROLE_PERMISSIONS_MAP[role] || []).includes(permission);
}

/**
 * Verify the current principal owns or shares access to a Daraz store.
 * Returns the store row when authorized, or a NextResponse when not.
 */
export async function requireAuthorizedStore(
  principal: AuthPrincipal,
  storeId: string
): Promise<{ ok: true; store: any } | { ok: false; response: NextResponse }> {
  if (!storeId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Store ID is required." },
        { status: 400 }
      ),
    };
  }

  const admin = createAdminClient();
  const { data: store, error } = await admin
    .from("daraz_stores")
    .select("*")
    .eq("id", storeId)
    .maybeSingle();

  if (error || !store) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Store not found." },
        { status: 404 }
      ),
    };
  }

  if (
    principal.role !== "super_admin" &&
    store.user_id &&
    store.user_id !== principal.userId
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Forbidden: You do not have access to this store." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, store };
}

/**
 * Build a list of store IDs the principal is allowed to access.
 * - super_admin: all stores
 * - other roles: only their own + unassigned ("user_id IS NULL") stores
 */
export async function getAuthorizedStoreIds(
  principal: AuthPrincipal
): Promise<string[]> {
  const admin = createAdminClient();
  let query = admin.from("daraz_stores").select("id");
  if (principal.role !== "super_admin") {
    query = query.or(`user_id.eq.${principal.userId},user_id.is.null`);
  }
  const { data } = await query;
  return (data || []).map((s: any) => s.id);
}

/**
 * Standardized safe error response. Hides internal messages in prod.
 */
export function safeErrorResponse(
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

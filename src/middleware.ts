import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { PROTECTED_ROUTES } from "@/lib/rbac/permissions";
import { AppRole } from "@/types/database.types";

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/seed-users",
  "/api/auth/daraz/login",
  "/api/auth/daraz/callback",
  "/api/auth/logout",
  "/api/daraz/callback",
  "/api/daraz/webhook",
];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Bypass static assets & Next internal assets
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Allow public API endpoints without requiring session
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const isAuthRoute = pathname === "/login" || pathname === "/signup" || pathname === "/unauthorized";

  try {
    // 3. Refresh Supabase Auth session & extract current user.
    // SECURITY: Only the Supabase session is trusted. The legacy
    // `daraz_ops_user` cookie previously enabled a privilege escalation where
    // a hand-crafted cookie payload (`{"role":"super_admin"}`) bypassed RBAC.
    // That fallback has been removed; routes must verify identity via Supabase.
    let { supabaseResponse, user, supabase } = await updateSession(request);

    // Block unauthenticated access to API routes
    if (!user && pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Active session required." },
        { status: 401 }
      );
    }

    // Redirect unauthenticated users trying to access protected UI pages
    if (!user && !isAuthRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      if (pathname !== "/" && pathname !== "/dashboard") {
        loginUrl.searchParams.set("redirectTo", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from /login or /signup unless resolving explicit logout/oauth messages
    if (user && (pathname === "/login" || pathname === "/signup")) {
      const hasMessages = searchParams.has("oauth_error") || searchParams.has("logged_out");
      if (!hasMessages) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = "/dashboard";
        return NextResponse.redirect(dashboardUrl);
      }
    }

    // Role-Based Access Control (RBAC) path protection.
    // Always resolves the role from the database (user_roles -> profiles),
    // falling back to user_metadata if database lookup returns empty.
    if (user && !isAuthRoute) {
      try {
        let userRole: AppRole | null = null;

        if (supabase && user?.id) {
          const { data: roleRow } = await (supabase as any)
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (roleRow?.role) {
            userRole = roleRow.role as AppRole;
          } else {
            const { data: profile } = await (supabase as any)
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();

            if (profile?.role) {
              userRole = profile.role as AppRole;
            }
          }
        }

        if (!userRole && (user as any)?.user_metadata?.role) {
          userRole = (user as any).user_metadata.role as AppRole;
        }

        const matchedGuard = PROTECTED_ROUTES.find((guard) =>
          pathname.startsWith(guard.pathPrefix)
        );

        if (matchedGuard) {
          const hasAccess =
            userRole === "super_admin" || (userRole ? matchedGuard.allowedRoles.includes(userRole) : false);

          if (!hasAccess) {
            if (pathname.startsWith("/api")) {
              return NextResponse.json(
                { success: false, error: `Forbidden: Role '${userRole}' cannot access '${pathname}'.` },
                { status: 403 }
              );
            }
            const unauthorizedUrl = request.nextUrl.clone();
            unauthorizedUrl.pathname = "/unauthorized";
            return NextResponse.redirect(unauthorizedUrl);
          }
        }
      } catch (rbacErr: any) {
        console.error("[Middleware RBAC Check Warning]:", rbacErr.message);
      }
    }

    return supabaseResponse || NextResponse.next();
  } catch (err: any) {
    console.error("[Root Middleware Exception]:", err.message);
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: "Internal Server Error in session middleware." },
        { status: 500 }
      );
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

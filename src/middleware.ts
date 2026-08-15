import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROTECTED_ROUTES } from "@/lib/rbac/permissions";
import { AppRole } from "@/types/database.types";

const PUBLIC_API_ROUTES = [
  "/api/auth/login",
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

  const isAuthRoute = pathname === "/login" || pathname === "/unauthorized";

  try {
    // 3. Refresh Supabase Auth session & extract current user
    let { supabaseResponse, user, supabase } = await updateSession(request);
    let isFallbackUser = false;

    // Fallback: check daraz_ops_user cookie
    if (!user) {
      const fallbackCookie = request.cookies.get("daraz_ops_user");
      if (fallbackCookie?.value) {
        try {
          user = JSON.parse(fallbackCookie.value);
          isFallbackUser = true;
        } catch (e) {
          // invalid JSON cookie
        }
      }
    }

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

    // Redirect authenticated users away from /login unless resolving explicit logout/oauth messages
    if (user && pathname === "/login") {
      const hasMessages = searchParams.has("oauth_error") || searchParams.has("logged_out");
      if (!hasMessages) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = "/dashboard";
        return NextResponse.redirect(dashboardUrl);
      }
    }

    // Role-Based Access Control (RBAC) path protection
    if (user && !isAuthRoute) {
      try {
        let userRole: AppRole | null = null;

        if (isFallbackUser) {
          // Cookie fallback login (daraz_ops_user): read role directly from cookie payload
          userRole =
            ((user as any)?.role as AppRole) ||
            ((user as any)?.user_metadata?.role as AppRole) ||
            ((user as any)?.app_metadata?.role as AppRole) ||
            null;
        }

        if (!userRole && user?.id) {
          // Real Supabase Auth session login: query profiles table using admin client to bypass RLS
          const adminSupabase = createAdminClient();
          const { data: profile } = await adminSupabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          userRole =
            (profile?.role as AppRole) ||
            ((user as any)?.role as AppRole) ||
            ((user as any)?.user_metadata?.role as AppRole) ||
            ((user as any)?.app_metadata?.role as AppRole) ||
            null;
        }

        if (!userRole) {
          userRole = "ops_manager";
        }

        const matchedGuard = PROTECTED_ROUTES.find((guard) =>
          pathname.startsWith(guard.pathPrefix)
        );

        if (matchedGuard) {
          const hasAccess =
            userRole === "super_admin" || matchedGuard.allowedRoles.includes(userRole);

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

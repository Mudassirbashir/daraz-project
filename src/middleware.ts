import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { PROTECTED_ROUTES } from "@/lib/rbac/permissions";
import { AppRole } from "@/types/database.types";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Instantly bypass API routes, _next static assets, and public files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isAuthRoute = pathname === "/login" || pathname === "/unauthorized";

  try {
    // 2. Refresh Supabase Auth session & extract current user
    const { supabaseResponse, user, supabase } = await updateSession(request);

    // Redirect unauthenticated users trying to access protected pages
    if (!user && !isAuthRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      if (pathname !== "/" && pathname !== "/dashboard") {
        loginUrl.searchParams.set("redirectTo", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from /login ONLY if they aren't resolving explicit parameters
    if (user && pathname === "/login") {
      const hasMessages = searchParams.has("oauth_error") || searchParams.has("logged_out");
      if (!hasMessages) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = "/dashboard";
        return NextResponse.redirect(dashboardUrl);
      }
    }

    // Role-Based Access Control (RBAC) path protection
    if (user && supabase && !isAuthRoute) {
      try {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const userRole: AppRole = (profile?.role as AppRole) || "ops_manager";

        const matchedGuard = PROTECTED_ROUTES.find((guard) =>
          pathname.startsWith(guard.pathPrefix)
        );

        if (matchedGuard) {
          const hasAccess =
            userRole === "super_admin" || matchedGuard.allowedRoles.includes(userRole);

          if (!hasAccess) {
            const unauthorizedUrl = request.nextUrl.clone();
            unauthorizedUrl.pathname = "/unauthorized";
            return NextResponse.redirect(unauthorizedUrl);
          }
        }
      } catch (rbacErr) {
        console.error("[Middleware RBAC Check Warning]:", rbacErr);
      }
    }

    return supabaseResponse || NextResponse.next();
  } catch (err: any) {
    console.error("[Root Middleware Exception]:", err.message);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { PROTECTED_ROUTES } from "@/lib/rbac/permissions";
import { AppRole } from "@/types/database.types";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Refresh Supabase Auth session & extract current user
  const { supabaseResponse, user, supabase } = await updateSession(request);

  // Allow static files, _next internal routes, and public assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return supabaseResponse;
  }

  const isAuthRoute = pathname === "/login" || pathname === "/unauthorized";

  // 2. Redirect unauthenticated users trying to access protected pages
  if (!user && !isAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Redirect authenticated users away from /login
  if (user && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  // 4. Role-Based Access Control (RBAC) path protection
  if (user && !isAuthRoute) {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole: AppRole = (profile?.role as AppRole) || "ops_manager";

    // Find matching route guard
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
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

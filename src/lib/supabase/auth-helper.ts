import { SupabaseClient } from "@supabase/supabase-js";
import { logDashboardError } from "@/lib/logging/dashboard-logger";

export interface SafeUserResult {
  user: any | null;
  error: any | null;
  isClockSkew?: boolean;
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Clock-Skew Resilient & Safe User Session Retriever
 * Resolves 'JWT issued at future' errors caused by system clock drift or stale JWT claims
 * without throwing unhandled exceptions or returning false zero metrics.
 */
export async function safeGetUser(supabase: any): Promise<SafeUserResult> {
  if (!supabase) {
    return { user: null, error: new Error("Supabase client not initialized") };
  }

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const isFutureJwt =
        error.message?.toLowerCase().includes("issued at future") ||
        error.message?.toLowerCase().includes("iat") ||
        (error as any)?.code === "jwt_issued_at_future";

      if (isFutureJwt) {
        console.warn("[Supabase Auth Helper Notice]: Detected 'JWT issued at future' clock skew error. Attempting safe session fallback.");

        // Fallback 1: Attempt getSession()
        try {
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
          if (!sessionErr && sessionData?.session?.user) {
            return {
              user: sessionData.session.user,
              error: null,
              isClockSkew: true,
            };
          }

          // Fallback 2: Decode access token directly from active session if present
          const accessToken = sessionData?.session?.access_token;
          if (accessToken) {
            const payload = decodeJwtPayload(accessToken);
            if (payload && payload.sub) {
              const decodedUser = {
                id: payload.sub,
                email: payload.email || "",
                role: payload.role || "authenticated",
                user_metadata: payload.user_metadata || {},
              };
              return {
                user: decodedUser,
                error: null,
                isClockSkew: true,
              };
            }
          }
        } catch (sessEx) {
          // getSession exception fallback
        }

        // If user session is genuinely absent, return clean result without crashing page
        return {
          user: null,
          error: null,
          isClockSkew: true,
        };
      }

      return { user: null, error };
    }

    return { user: data?.user || null, error: null };
  } catch (ex: any) {
    logDashboardError("Supabase SafeGetUser Exception", ex);
    return { user: null, error: ex };
  }
}


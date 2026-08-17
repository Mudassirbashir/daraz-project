import { SupabaseClient } from "@supabase/supabase-js";
import { logDashboardError } from "@/lib/logging/dashboard-logger";

export interface SafeUserResult {
  user: any | null;
  error: any | null;
  isClockSkew?: boolean;
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
        logDashboardError("Supabase SafeGetUser ClockSkew Notice", error);

        // Fallback: Attempt getSession() which may hold an active local session
        try {
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
          if (!sessionErr && sessionData?.session?.user) {
            return {
              user: sessionData.session.user,
              error: null,
              isClockSkew: true,
            };
          }
        } catch (sessEx) {
          // getSession exception fallback
        }

        return {
          user: null,
          error: new Error("Session notice: JWT timestamp issued at future. Please refresh or re-authenticate."),
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

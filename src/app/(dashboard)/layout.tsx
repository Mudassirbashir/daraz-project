import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/common/DashboardShell";
import { StoreOption } from "@/components/common/StoreSwitcher";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeGetUser } from "@/lib/supabase/auth-helper";
import { resolveRoleServerSide } from "@/lib/api/auth-guard";
import { AppRole } from "@/types/database.types";
import { logDashboardError } from "@/lib/logging/dashboard-logger";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let supabase: ReturnType<typeof createClient> | null = null;
  let adminSupabase: ReturnType<typeof createAdminClient> | null = null;
  let clientInitError: string | null = null;

  // Safe Supabase Client Initializations
  try {
    supabase = createClient();
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || err?.message?.includes("Dynamic server usage")) {
      throw err;
    }
    clientInitError = err?.message || String(err);
    logDashboardError("Layout Server Supabase Init", err);
  }

  try {
    adminSupabase = createAdminClient();
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || err?.message?.includes("Dynamic server usage")) {
      throw err;
    }
    if (!clientInitError) clientInitError = err?.message || String(err);
    logDashboardError("Layout Admin Supabase Init", err);
  }

  // Fetch authenticated user & profile
  const cookieStore = cookies();
  const opsCookieVal = cookieStore.get("daraz_ops_user")?.value || null;

  let user: any = null;
  if (supabase) {
    const safeRes = await safeGetUser(supabase, opsCookieVal);
    user = safeRes.user;
    if (safeRes.error && !safeRes.isClockSkew) {
      logDashboardError("Layout getUser Auth Check", safeRes.error);
    }
  }

  if (!user) {
    return redirect('/login');
  }

  let userRole: AppRole = "ops_manager";
  let userName = "Team Member";

  if (user) {
    let parsedCookie: any = null;
    if (opsCookieVal) {
      try { parsedCookie = JSON.parse(opsCookieVal); } catch (_) {}
    }

    const fallbackRole = parsedCookie?.role || (user as any)?.user_metadata?.role;
    const resolvedRole = await resolveRoleServerSide(user.id, user.email || null, fallbackRole);
    userRole = resolvedRole || "ops_manager";

    if (supabase) {
      try {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          userName = profile.full_name;
        } else if ((user as any)?.user_metadata?.full_name || parsedCookie?.full_name) {
          userName = (user as any)?.user_metadata?.full_name || parsedCookie?.full_name;
        } else {
          userName = user.email || "Team Member";
        }
      } catch (_) {
        userName = (user as any)?.user_metadata?.full_name || parsedCookie?.full_name || user.email || "Team Member";
      }
    } else {
      userName = (user as any)?.user_metadata?.full_name || parsedCookie?.full_name || user.email || "Team Member";
    }
  }

  // Fetch active connected Daraz Stores
  let rawStores: any[] = [];
  
  if (adminSupabase) {
    try {
      let storesQuery = (adminSupabase as any)
        .from("daraz_stores")
        .select("id, store_code, store_name, seller_id, is_active, region, slot_number, authorization_status")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (user?.id) {
        storesQuery = storesQuery.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { data, error } = await storesQuery;
      if (error) {
        // Fallback: exclude authorization_status column if missing on DB
        let fbQuery = (adminSupabase as any)
          .from("daraz_stores")
          .select("id, store_code, store_name, seller_id, is_active, region, slot_number")
          .eq("is_active", true)
          .order("created_at", { ascending: true });

        if (user?.id) {
          fbQuery = fbQuery.or(`user_id.eq.${user.id},user_id.is.null`);
        }

        const { data: fbData, error: fbErr } = await fbQuery;
        if (fbErr) {
          const isClockSkew = fbErr.message?.toLowerCase().includes("issued at future") || fbErr.message?.toLowerCase().includes("iat");
          if (!isClockSkew) {
            logDashboardError("Layout Stores Query Fallback", fbErr);
          }
        } else {
          rawStores = fbData || [];
        }
      } else {
        rawStores = data || [];
      }
    } catch (storesEx: any) {
      logDashboardError("Layout Stores Exception", storesEx);
    }
  }

  const stores: StoreOption[] = (rawStores || []).map((s: any) => ({
    id: s.id,
    store_code: s.store_code,
    store_name: s.store_name,
    seller_id: s.seller_id,
    is_active: s.is_active,
    has_token: Boolean(s.is_active),
    slot_number: s.slot_number,
  }));

  const region = rawStores && rawStores.length > 0 ? rawStores[0].region || "PK" : "PK";

  return (
    <DashboardShell
      userRole={userRole}
      userName={userName}
      stores={stores}
      region={region}
    >
      {children}
    </DashboardShell>
  );
}

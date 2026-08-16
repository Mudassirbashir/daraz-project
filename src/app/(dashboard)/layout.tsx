import React from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { StoreOption } from "@/components/common/StoreSwitcher";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  let user: any = null;
  if (supabase) {
    try {
      const { data, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        logDashboardError("Layout getUser Auth Check", userErr);
      }
      user = data?.user || null;
    } catch (authEx: any) {
      logDashboardError("Layout getUser Auth Exception", authEx);
    }
  }

  let userRole: AppRole = "ops_manager";
  let userName = "Team Member";

  if (user && supabase) {
    try {
      const { data: profile, error: profileErr } = await (supabase as any)
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        logDashboardError("Layout Profile Query", profileErr);
      }

      if (profile) {
        userRole = (profile.role as AppRole) || "ops_manager";
        userName = profile.full_name || user.email || "Team Member";
      } else {
        userName = user.email || "Team Member";
      }
    } catch (profileEx: any) {
      logDashboardError("Layout Profile Exception", profileEx);
      userName = user.email || "Team Member";
    }
  }

  // Fetch active connected Daraz Stores
  let rawStores: any[] = [];
  let storeQueryError: string | null = null;

  if (adminSupabase) {
    try {
      let storesQuery = (adminSupabase as any)
        .from("daraz_stores")
        .select("id, store_code, store_name, seller_id, is_active, access_token, region")
        .eq("is_active", true)
        .not("access_token", "is", null)
        .order("created_at", { ascending: true });

      if (user?.id) {
        storesQuery = storesQuery.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { data, error: storesErr } = await storesQuery;

      if (storesErr) {
        storeQueryError = storesErr.message;
        logDashboardError("Layout Stores Query", storesErr);
      } else {
        rawStores = data || [];
      }
    } catch (storesEx: any) {
      storeQueryError = storesEx?.message || String(storesEx);
      logDashboardError("Layout Stores Exception", storesEx);
    }
  }

  const stores: StoreOption[] = (rawStores || []).map((s: any) => ({
    id: s.id,
    store_code: s.store_code,
    store_name: s.store_name,
    seller_id: s.seller_id,
    is_active: s.is_active,
    has_token: Boolean(s.access_token),
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

import React from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { StoreOption } from "@/components/common/StoreSwitcher";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppRole } from "@/types/database.types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // Note: Legacy seed data purge was removed to prevent accidental deletion of production stores

  // Fetch authenticated user & profile
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: AppRole = "ops_manager";
  let userName = "Team Member";

  if (user) {
    try {
      const { data: profile, error: profileErr } = await (supabase as any)
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr) {
        console.error("[DASHBOARD FATAL ERROR - Layout Profile Query]:", {
          name: profileErr.name,
          message: profileErr.message,
          code: (profileErr as any).code,
          details: (profileErr as any).details,
          hint: (profileErr as any).hint,
        });
      }

      if (profile) {
        userRole = (profile.role as AppRole) || "ops_manager";
        userName = profile.full_name || user.email || "Team Member";
      } else {
        userName = user.email || "Team Member";
      }
    } catch (profileEx: any) {
      console.error("[DASHBOARD FATAL ERROR - Layout Profile Exception]:", {
        name: profileEx?.name,
        message: profileEx?.message || String(profileEx),
        stack: profileEx?.stack,
      });
      userName = user.email || "Team Member";
    }
  }

  // Fetch active connected Daraz Stores belonging to user
  let rawStores: any[] = [];
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
      console.error("[DASHBOARD FATAL ERROR - Layout Stores Query]:", {
        name: storesErr.name,
        message: storesErr.message,
        code: (storesErr as any).code,
        details: (storesErr as any).details,
        hint: (storesErr as any).hint,
      });
    } else {
      rawStores = data || [];
    }
  } catch (storesEx: any) {
    console.error("[DASHBOARD FATAL ERROR - Layout Stores Exception]:", {
      name: storesEx?.name,
      message: storesEx?.message || String(storesEx),
      stack: storesEx?.stack,
    });
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

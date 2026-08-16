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
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (profile) {
      userRole = (profile.role as AppRole) || "ops_manager";
      userName = profile.full_name || user.email || "Team Member";
    } else {
      userName = user.email || "Team Member";
    }
  }

  // Fetch active connected Daraz Stores belonging to user
  let storesQuery = (adminSupabase as any)
    .from("daraz_stores")
    .select("id, store_code, store_name, seller_id, is_active, access_token, region")
    .eq("is_active", true)
    .not("access_token", "is", null)
    .order("created_at", { ascending: true });

  if (user?.id) {
    storesQuery = storesQuery.or(`user_id.eq.${user.id},user_id.is.null`);
  }

  const { data: rawStores } = await storesQuery;

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

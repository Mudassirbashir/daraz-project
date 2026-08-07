import React from "react";
import { DashboardShell } from "@/components/common/DashboardShell";
import { StoreOption } from "@/components/common/StoreSwitcher";
import { createClient } from "@/lib/supabase/server";
import { AppRole } from "@/types/database.types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

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

  // Fetch all active Daraz Stores (up to 3)
  const { data: rawStores } = await (supabase as any)
    .from("daraz_stores")
    .select("id, store_code, store_name, seller_id, is_active, access_token")
    .order("store_code", { ascending: true });

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

import React from "react";
import { cookies } from "next/headers";
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
  } else if (opsCookieVal) {
    try {
      const parsed = JSON.parse(opsCookieVal);
      if (parsed?.id && parsed?.email) {
        user = {
          id: parsed.id,
          email: parsed.email,
          user_metadata: parsed.user_metadata || { full_name: parsed.full_name, role: parsed.role },
        };
      }
    } catch (_) {}
  }

  // If no authenticated user found, show role selection instead of defaulting to ops_manager
  if (!user) {
    // Return role selection UI (client component)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 font-black text-white text-4xl shadow-lg shadow-orange-500/30">
              D
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              Welcome to Daraz Operations
            </h2>
            <p className="mt-2 text-slate-600">
              Please select your role to access the application:
            </p>
          </div>

          <div className="space-y-6">
            {/* Admin Option */}
            <button
              onClick={() => {
                // Set cookie for admin (super_admin) user
                document.cookie = "daraz_ops_user=" + encodeURIComponent(JSON.stringify({
                  id: "00000000-0000-0000-0000-000000000001",
                  email: "mubashir@darazops.internal",
                  user_metadata: { full_name: "Mubashir", role: "super_admin" }
                })) + "; path=/; max-age=604800"; // 7 days
                window.location.reload();
              }}
              className="w-full flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center">
                  <span className="block font-bold text-slate-800">Mubashir</span>
                  <span className="text-[10px] text-slate-500">Super Admin</span>
                </div>
                <span className="ml-auto text-[10px] text-slate-400">Admin</span>
              </div>
            </button>

            {/* Operation Option */}
            <button
              onClick={() => {
                // Set cookie for operation (ops_manager) user
                document.cookie = "daraz_ops_user=" + encodeURIComponent(JSON.stringify({
                  id: "00000000-0000-0000-0000-000000000002",
                  email: "zainab@darazops.internal",
                  user_metadata: { full_name: "Zainab", role: "ops_manager" }
                })) + "; path=/; max-age=604800"; // 7 days
                window.location.reload();
              }}
              className="w-full flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center">
                  <span className="block font-bold text-slate-800">Zainab</span>
                  <span className="text-[10px] text-slate-500">Ops Manager</span>
                </div>
                <span className="ml-auto text-[10px] text-slate-400">Operation</span>
              </div>
            </button>

            {/* Direct Account Entry Option */}
            <button
              onClick={() => {
                // Set cookie for direct account (product_manager) user
                document.cookie = "daraz_ops_user=" + encodeURIComponent(JSON.stringify({
                  id: "00000000-0000-0000-0000-000000000003",
                  email: "mudassir@darazops.internal",
                  user_metadata: { full_name: "Mudassir", role: "product_manager" }
                })) + "; path=/; max-age=604800"; // 7 days
                window.location.reload();
              }}
              className="w-full flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center">
                  <span className="block font-bold text-slate-800">Mudassir</span>
                  <span className="text-[10px] text-slate-500">Product Manager</span>
                </div>
                <span className="ml-auto text-[10px] text-slate-400">Direct Account</span>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center text-slate-500 text-xs">
            <p>
              Don't see your role? <span className="font-medium text-orange-600 hover:text-orange-700 underline">
                Contact system administrator
              </span>
            </p>
          </div>
        </div>
      </div>
    );
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
  let storeQueryError: string | null = null;

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
            storeQueryError = fbErr.message;
            logDashboardError("Layout Stores Query Fallback", fbErr);
          }
        } else {
          rawStores = fbData || [];
        }
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

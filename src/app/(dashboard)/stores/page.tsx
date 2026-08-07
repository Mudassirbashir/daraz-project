import React from "react";
import { Store, ShieldCheck, RefreshCw, Key, AlertTriangle, CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const supabase = createAdminClient();

  // Fetch all connected Daraz stores from Supabase
  const { data: stores } = await supabase
    .from("daraz_stores")
    .select("*")
    .order("store_code", { ascending: true });

  const storesList = stores || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daraz Store Accounts & Authorization</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Manage your connected Daraz seller accounts, OAuth credentials, and API authorization tokens.
          </p>
        </div>

        <a
          href="/api/auth/daraz/login"
          className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:brightness-105 transition-all apple-press shrink-0"
        >
          <Store className="h-4 w-4" />
          <span>Connect New Daraz Account</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* Stores Account Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {storesList.map((store: any, idx: number) => {
          const isConnected = Boolean(store.access_token);
          const expiresAt = store.token_expires_at ? new Date(store.token_expires_at) : null;
          const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : true;

          return (
            <div
              key={store.id}
              className={`rounded-2xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 shadow-apple flex flex-col justify-between space-y-4 transition-all duration-200 hover:shadow-apple-hover ${
                isConnected && !isExpired
                  ? "border-emerald-200/80 dark:border-emerald-500/30"
                  : "border-amber-200/80 dark:border-amber-500/30"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    Slot #{idx + 1}: {store.store_code}
                  </span>

                  {isConnected && !isExpired ? (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>{isConnected ? "Token Expired" : "OAuth Needed"}</span>
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{store.store_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">Seller ID: {store.seller_id}</p>
                </div>

                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Region:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{store.region || "PK"}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">App Key:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {store.api_app_key || process.env.DARAZ_APP_KEY || "Configured"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Token Status:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {isConnected ? (isExpired ? "Needs Refresh" : "Active & Valid") : "No Token"}
                    </span>
                  </div>

                  {expiresAt && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Expires At:</span>
                      <span className="font-mono text-slate-500">{expiresAt.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="/api/auth/daraz/login"
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-950 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-all apple-press shadow-xs"
                >
                  <Key className="h-3.5 w-3.5 text-orange-400" />
                  <span>{isConnected ? "Re-Authorize Account" : "Connect Store OAuth"}</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

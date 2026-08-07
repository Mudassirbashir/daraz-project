import React from "react";
import { Store, ShieldCheck, RefreshCw, Key, AlertTriangle, CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const supabase = createClient();

  // Fetch all 3 Daraz stores from Supabase
  const { data: stores } = await (supabase as any)
    .from("daraz_stores")
    .select("*")
    .order("store_code", { ascending: true });

  const storesList = stores || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daraz Store Accounts & Authorization</h1>
          <p className="text-sm text-slate-500">
            Manage your 3 connected Daraz seller accounts, OAuth credentials, and API authorization tokens.
          </p>
        </div>

        <a
          href="/api/auth/daraz/login"
          className="inline-flex items-center space-x-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all shrink-0"
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
              className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between space-y-4 transition-all ${
                isConnected && !isExpired
                  ? "border-emerald-200 hover:border-emerald-300"
                  : "border-amber-200 hover:border-amber-300"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-200">
                    Slot #{idx + 1}: {store.store_code}
                  </span>

                  {isConnected && !isExpired ? (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span>{isConnected ? "Token Expired" : "OAuth Needed"}</span>
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{store.store_name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">Seller ID: {store.seller_id}</p>
                </div>

                <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Region:</span>
                    <span className="font-semibold text-slate-800">{store.region || "PK"}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">App Key:</span>
                    <span className="font-mono text-slate-800">{store.api_app_key || "504904"}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Token Status:</span>
                    <span className="font-semibold text-slate-800">
                      {isConnected ? (isExpired ? "Needs Refresh" : "Active & Valid") : "No Token"}
                    </span>
                  </div>

                  {expiresAt && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Expires At:</span>
                      <span className="font-mono text-slate-600">{expiresAt.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <a
                  href="/api/auth/daraz/login"
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-all"
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

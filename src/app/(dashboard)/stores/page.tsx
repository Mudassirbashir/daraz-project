import React from "react";
import { Store, CheckCircle2, AlertCircle, RefreshCw, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const supabase = createClient();

  const { data: stores } = await (supabase as any)
    .from("daraz_stores")
    .select("*")
    .order("store_code", { ascending: true });

  const storesList = stores || [];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Stores</h1>
          <p className="text-sm text-slate-500">
            See all your online stores and manage their connections.
          </p>
        </div>

        <a
          href="/api/auth/daraz/login"
          title="Connect a new Daraz seller account"
          className="inline-flex items-center space-x-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Store</span>
        </a>
      </div>

      {/* Stores List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
        {storesList.map((store: any) => {
          const isConnected = !!store.access_token;

          return (
            <div key={store.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{store.store_name}</h3>
                    <p className="text-[11px] font-mono text-slate-500">{store.store_code}</p>
                  </div>
                </div>

                {isConnected ? (
                  <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700 border border-amber-200">
                    <AlertCircle className="h-3 w-3 text-amber-600" />
                    <span>Needs Connection</span>
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <a
                  href="/api/auth/daraz/login"
                  title="Reconnect your Daraz store"
                  className="flex w-full items-center justify-center space-x-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Reconnect Store</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

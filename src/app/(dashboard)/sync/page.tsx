import React from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { RefreshCw, Store, Tag, ShoppingCart, KeyRound, ShieldCheck, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  const supabase = createClient();

  // Query live metrics from Supabase
  const { count: storesCount } = await (supabase as any)
    .from("daraz_stores")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: listingsCount } = await (supabase as any)
    .from("listings")
    .select("*", { count: "exact", head: true });

  const { count: ordersCount } = await (supabase as any)
    .from("orders")
    .select("*", { count: "exact", head: true });

  // Query live API logs
  const { data: logs } = await (supabase as any)
    .from("daraz_api_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Update Data</h1>
          <p className="text-sm text-slate-500">
            Fetch the latest products and orders from your connected online stores.
          </p>
        </div>
      </div>

      {/* Sync Control Header Card */}
      <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-orange-600 font-semibold text-sm">
              <RefreshCw className="h-4 w-4" />
              <span>Update Data from Daraz</span>
            </div>
            <p className="text-xs text-slate-600">
              Click <strong>Update Data</strong> to download your latest products, prices, and orders into your app.
            </p>
          </div>
          <SyncNowButton />
        </div>
      </div>

      {/* Operational Sync Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Active Stores</span>
            <Store className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{storesCount || 0} active</p>
          <span className="text-xs text-slate-500 font-medium">Connected seller accounts</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Updated Products</span>
            <Tag className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{listingsCount || 0} products</p>
          <span className="text-xs text-emerald-600 font-medium">Saved in database</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Updated Orders</span>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{ordersCount || 0} orders</p>
          <span className="text-xs text-blue-600 font-medium">Saved in database</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Connection Status</span>
            <ShieldCheck className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">Secure</p>
          <span className="text-xs text-purple-600 font-medium">Daraz API connected</span>
        </div>
      </div>

      {/* Live API Execution Logs */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Clock className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">Live Daraz API Execution Audit Logs</h2>
        </div>

        {logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2">Sync Type</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Records Synced</th>
                  <th className="px-4 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{log.sync_type}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                          log.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {log.status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-600" />
                        )}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{log.records_synced || 0}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No API execution logs recorded yet. Trigger a sync using the button above.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { History, RefreshCw, UserCheck, Activity, Search } from "lucide-react";

export function AuditLogsView() {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [orderActivities, setOrderActivities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"system" | "orders">("orders");
  const [filterQuery, setFilterQuery] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit-logs");
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.auditLogs || []);
        setOrderActivities(data.orderActivities || []);
      }
    } catch (err: any) {
      console.error("[FetchAuditLogs Error]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredOrders = orderActivities.filter((act) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      act.daraz_order_id?.toLowerCase().includes(q) ||
      act.actor?.toLowerCase().includes(q) ||
      act.new_status?.toLowerCase().includes(q)
    );
  });

  const filteredSystem = auditLogs.filter((log) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      log.actor_name?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 text-xs">
      {/* Top Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 font-bold rounded-xl transition-all ${
              activeTab === "orders"
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Order Workflow Activity ({orderActivities.length})
          </button>

          <button
            onClick={() => setActiveTab("system")}
            className={`px-4 py-2 font-bold rounded-xl transition-all ${
              activeTab === "system"
                ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            System Audit Trail ({auditLogs.length})
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit log..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-orange-500 mb-2" />
            <span>Loading audit records...</span>
          </div>
        ) : activeTab === "orders" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Transition</th>
                  <th className="p-3">Actor / User</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No order workflow activities found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        #{act.daraz_order_id}
                      </td>
                      <td className="p-3 font-bold">
                        <span className="text-slate-400 font-normal">{act.previous_status || "None"}</span> →{" "}
                        <span className="text-emerald-600 dark:text-emerald-400 uppercase">
                          {act.new_status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                        {act.actor}
                      </td>
                      <td className="p-3 text-slate-500">{act.source}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{act.notes || "-"}</td>
                      <td className="p-3 text-right text-slate-500 font-mono">
                        {new Date(act.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3">Actor</th>
                  <th className="p-3">Entity Type</th>
                  <th className="p-3">Entity ID</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Source</th>
                  <th className="p-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSystem.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No system audit logs found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredSystem.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {log.actor_name}
                      </td>
                      <td className="p-3 uppercase font-mono font-bold text-blue-600 dark:text-blue-400">
                        {log.entity_type}
                      </td>
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                        {log.entity_id}
                      </td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                        {log.action}
                      </td>
                      <td className="p-3 text-slate-500">{log.source}</td>
                      <td className="p-3 text-right text-slate-500 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

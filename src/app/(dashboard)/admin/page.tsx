"use client";

import React, { useState, useEffect } from "react";
import { RoleBadge } from "@/components/common/RoleBadge";
import {
  Settings,
  ShieldCheck,
  Lock,
  RefreshCw,
  AlertCircle,
  Download,
  Users,
  Key,
  CheckCircle2,
  Columns,
  Search,
  Globe,
  Database
} from "lucide-react";

export default function AdminPage() {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [systemIntegrations, setSystemIntegrations] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    email: true,
    role: true,
    status: true,
    lastActive: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  const fetchAdminDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();

      if (data.success) {
        setTeamMembers(data.teamMembers || []);
        setSystemIntegrations(data.systemIntegrations || {});
      } else {
        console.error("[FetchAdminDetails API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchAdminDetails Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminDetails();
  }, []);

  const exportToCSV = () => {
    if (teamMembers.length === 0) {
      alert("No admin records available to export.");
      return;
    }

    const headers = ["User ID", "Name", "Email", "Role", "Status", "Last Active"];
    const rows = teamMembers.map((m) => [
      `"${m.id}"`,
      `"${m.name}"`,
      `"${m.email}"`,
      `"${m.role}"`,
      `"${m.status}"`,
      `"${new Date(m.lastActive).toLocaleString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_ERP_System_Admin_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Status Badge */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-xs text-slate-500">
            Manage team members, permissions, and app settings.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download team members list as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download User List</span>
          </button>

          <span className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-xs">
            <Lock className="h-3.5 w-3.5 text-purple-700" />
            <span>Admin Settings</span>
          </span>
        </div>
      </div>

      {/* Controls Bar: Search & Column Selector */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team members by Name, Email, or Role..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Column Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              title="Choose which columns to show"
              className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-3 py-2 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-30 space-y-2 text-xs">
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">Toggle Columns</p>
                {Object.keys(columnVisibility).map((colKey) => (
                  <label key={colKey} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded-md">
                    <input
                      type="checkbox"
                      checked={(columnVisibility as any)[colKey]}
                      onChange={(e) =>
                        setColumnVisibility({
                          ...columnVisibility,
                          [colKey]: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="capitalize text-slate-700">{colKey.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team RBAC Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />
            <span>Loading team members...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.name && <th className="px-4 py-3">User Name</th>}
                  {columnVisibility.email && <th className="px-4 py-3">Email Address</th>}
                  {columnVisibility.role && <th className="px-4 py-3">Access Level</th>}
                  {columnVisibility.status && <th className="px-4 py-3">Account Status</th>}
                  {columnVisibility.lastActive && <th className="px-4 py-3">Last Active</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    {columnVisibility.name && (
                      <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
                    )}

                    {columnVisibility.email && (
                      <td className="px-4 py-3 font-mono text-slate-700">{m.email}</td>
                    )}

                    {columnVisibility.role && (
                      <td className="px-4 py-3">
                        <RoleBadge role={m.role} userName={m.name} />
                      </td>
                    )}

                    {columnVisibility.status && (
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Active Member</span>
                        </span>
                      </td>
                    )}

                    {columnVisibility.lastActive && (
                      <td className="px-4 py-3 text-slate-500 text-[11px] font-mono">
                        {new Date(m.lastActive).toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

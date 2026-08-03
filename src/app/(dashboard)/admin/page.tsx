import React from "react";
import { Settings, Lock } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System & Team Administration</h1>
          <p className="text-sm text-slate-500">
            System settings, team member roles (Mubashir, Mudassir, Zainab), and global API configuration.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          <Lock className="mr-1.5 h-3.5 w-3.5" /> Mubashir Only
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-700">
          <Settings className="h-6 w-6 text-slate-700" />
          <p className="text-sm font-medium">System Administration Module Shell - Protected for Super Admin.</p>
        </div>
      </div>
    </div>
  );
}

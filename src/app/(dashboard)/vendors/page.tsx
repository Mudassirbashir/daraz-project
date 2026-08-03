import React from "react";
import { Users } from "lucide-react";

export default function VendorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vendors & Suppliers Management</h1>
        <p className="text-sm text-slate-500">
          Manage manufacturer contacts, lead times, MOQ requirements, and vendor ratings (Mudassir & Mubashir).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-700">
          <Users className="h-6 w-6 text-blue-500" />
          <p className="text-sm font-medium">Vendors Module Shell - Ready for feature implementation.</p>
        </div>
      </div>
    </div>
  );
}

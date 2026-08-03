import React from "react";
import { Tag } from "lucide-react";

export default function ListingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Daraz Store Listings</h1>
        <p className="text-sm text-slate-500">
          Manage product listings across stores, seller SKUs, pricing, and sync status (Mudassir & Zainab).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-700">
          <Tag className="h-6 w-6 text-emerald-500" />
          <p className="text-sm font-medium">Listings Module Shell - Ready for feature implementation.</p>
        </div>
      </div>
    </div>
  );
}

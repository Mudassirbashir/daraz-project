import React from "react";
import { Store } from "lucide-react";

export default function StoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Daraz Stores Accounts</h1>
        <p className="text-sm text-slate-500">
          Manage seller accounts, API keys, OAuth tokens, and regional store configurations (Mubashir).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-700">
          <Store className="h-6 w-6 text-orange-500" />
          <p className="text-sm font-medium">Daraz Stores Module Shell - Ready for feature implementation.</p>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Lightbulb, Store, ShoppingCart, CheckSquare, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Daraz Operations Command Center</h1>
        <p className="text-sm text-slate-500">
          Internal operations hub for Mubashir (Admin), Mudassir (Product Manager), and Zainab (Ops Manager).
        </p>
      </div>

      {/* Metrics Shell */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Products in R&D</span>
            <Lightbulb className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">12 SKUs</p>
          <span className="text-xs text-blue-600 font-medium">Mudassir managing samples</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Active Daraz Stores</span>
            <Store className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">4 Stores</p>
          <span className="text-xs text-emerald-600 font-medium">PK, BD, LK, NP Active</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Today's Orders</span>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">248 Orders</p>
          <span className="text-xs text-slate-500 font-medium">Zainab processing dispatch</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Pending Tasks</span>
            <CheckSquare className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">7 Urgent</p>
          <span className="text-xs text-purple-600 font-medium">Team Board Active</span>
        </div>
      </div>
    </div>
  );
}

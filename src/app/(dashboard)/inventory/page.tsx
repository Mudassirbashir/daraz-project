import React from "react";
import { Boxes } from "lucide-react";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Central Inventory Control</h1>
        <p className="text-sm text-slate-500">
          Track stock on hand, reserved quantities, reorder points, and storage locations (Zainab).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-700">
          <Boxes className="h-6 w-6 text-indigo-500" />
          <p className="text-sm font-medium">Inventory Module Shell - Ready for feature implementation.</p>
        </div>
      </div>
    </div>
  );
}

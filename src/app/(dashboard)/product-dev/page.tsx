import React from "react";
import { Lightbulb } from "lucide-react";

export default function ProductDevPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Development (R&D)</h1>
        <p className="text-sm text-slate-500">
          Track product ideation, sample testing, costing approvals, and listing readiness (Mudassir).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-700">
          <Lightbulb className="h-6 w-6 text-amber-500" />
          <p className="text-sm font-medium">Product Development Module Shell - Ready for feature implementation.</p>
        </div>
      </div>
    </div>
  );
}

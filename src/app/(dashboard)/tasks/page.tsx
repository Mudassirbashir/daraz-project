import React from "react";
import { CheckSquare } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team Task Board</h1>
        <p className="text-sm text-slate-500">
          Task assignment and tracking board for Mubashir, Mudassir, and Zainab.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-3 text-slate-700">
          <CheckSquare className="h-6 w-6 text-purple-500" />
          <p className="text-sm font-medium">Team Tasks Board Module Shell - Ready for feature implementation.</p>
        </div>
      </div>
    </div>
  );
}

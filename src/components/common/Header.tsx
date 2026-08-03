import React from "react";
import { RoleBadge } from "./RoleBadge";
import { AppRole } from "@/types/database.types";
import { Globe, Store, RefreshCw } from "lucide-react";

interface HeaderProps {
  userName?: string;
  userRole?: AppRole;
  activeStore?: string;
  region?: string;
}

export function Header({
  userName = "Mubashir",
  userRole = "super_admin",
  activeStore = "Daraz Flagship Store PK",
  region = "PK",
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      {/* Region & Active Store Indicator */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 rounded-md bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200">
          <Globe className="h-4 w-4" />
          <span>Region: {region}</span>
        </div>
        <div className="flex items-center space-x-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
          <Store className="h-4 w-4 text-slate-500" />
          <span>Store: <strong className="text-slate-900">{activeStore}</strong></span>
        </div>
      </div>

      {/* Sync Status & User Role Badge */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Daraz API Active</span>
        </div>
        <RoleBadge role={userRole} userName={userName} />
      </div>
    </header>
  );
}

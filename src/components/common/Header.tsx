import React from "react";
import { RoleBadge } from "./RoleBadge";
import { StoreSwitcher, StoreOption } from "./StoreSwitcher";
import { AppRole } from "@/types/database.types";
import { Globe, RefreshCw, LogOut, AlertTriangle } from "lucide-react";

interface HeaderProps {
  userName?: string;
  userRole?: AppRole;
  stores?: StoreOption[];
  region?: string;
}

export function Header({
  userName = "Team Member",
  userRole = "ops_manager",
  stores = [],
  region = "PK",
}: HeaderProps) {
  const activeCount = stores.filter((s) => s.has_token).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      {/* Region Indicator & Store Switcher */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 rounded-md bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 border border-orange-200">
          <Globe className="h-4 w-4" />
          <span>Region: {region}</span>
        </div>

        <StoreSwitcher stores={stores} />
      </div>

      {/* Sync Status, User Role Badge & Logout Button */}
      <div className="flex items-center space-x-4">
        {activeCount > 0 ? (
          <div className="flex items-center space-x-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{activeCount} / {stores.length || 3} Stores Linked</span>
          </div>
        ) : (
          <a
            href="/api/auth/daraz/login"
            className="flex items-center space-x-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-semibold hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>Connect Daraz Store</span>
          </a>
        )}

        <RoleBadge role={userRole} userName={userName} />

        <a
          href="/api/auth/logout"
          className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 transition-all"
          title="Sign out of Operations Portal"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Logout</span>
        </a>
      </div>
    </header>
  );
}

import React from "react";
import { RoleBadge } from "./RoleBadge";
import { StoreSwitcher, StoreOption } from "./StoreSwitcher";
import { AppRole } from "@/types/database.types";
import { Globe, RefreshCw, LogOut, AlertTriangle, Menu, Search } from "lucide-react";

interface HeaderProps {
  userName?: string;
  userRole?: AppRole;
  stores?: StoreOption[];
  region?: string;
  onToggleMobileMenu?: () => void;
}

export function Header({
  userName = "Team Member",
  userRole = "ops_manager",
  stores = [],
  region = "PK",
  onToggleMobileMenu,
}: HeaderProps) {
  const activeCount = stores.filter((s) => s.has_token).length;

  return (
    <header className="sticky top-0 z-20 flex min-h-[72px] w-full items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/90 select-none shrink-0">
      {/* Mobile Hamburger & Region / Store Switcher */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            title="Toggle mobile menu"
            className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all apple-press"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div
          title="Store location country"
          className="hidden sm:flex items-center space-x-1.5 rounded-xl bg-orange-50/80 dark:bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-500/20 shadow-xs apple-press cursor-default"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Pakistan ({region})</span>
        </div>

        <StoreSwitcher stores={stores} />
      </div>

      {/* Global Search Bar (PART 19) */}
      <form
        action="/orders"
        method="GET"
        className="hidden md:flex flex-1 max-w-md mx-4"
      >
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="search"
            placeholder="Global Search: Order ID, SKU, Name, Phone, Tracking, Store..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-9 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </form>

      {/* Sync Status, User Role Badge & Logout Button */}
      <div className="flex items-center space-x-1.5 sm:space-x-3">
        {activeCount > 0 ? (
          <div
            title="Connected Daraz seller accounts"
            className="hidden sm:flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-500/20 font-bold shadow-xs cursor-default"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{activeCount} / {stores.length || 3} Active</span>
          </div>
        ) : (
          <a
            href="/api/auth/daraz/login"
            title="Connect your live Daraz seller account"
            className="flex items-center space-x-1 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-500/20 font-bold hover:bg-amber-100 transition-all apple-press shadow-xs"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>Connect</span>
          </a>
        )}

        <RoleBadge role={userRole} userName={userName} />

        <a
          href="/api/auth/logout"
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-red-200 transition-all apple-press shadow-xs"
          title="Sign out of your account"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </a>
      </div>
    </header>
  );
}

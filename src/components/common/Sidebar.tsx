"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  ShoppingCart,
  Boxes,
  Store,
  Truck,
  RefreshCw,
  Settings,
  LogOut,
  X,
  Sparkles
} from "lucide-react";
import { AppRole } from "@/types/database.types";

interface SidebarProps {
  userRole?: AppRole;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  badge?: string;
}

interface NavSection {
  sectionTitle: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    sectionTitle: "Main",
    items: [
      {
        title: "Home",
        subtitle: "Operational dashboard",
        href: "/dashboard",
        icon: Home,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
    ],
  },
  {
    sectionTitle: "Store & Sales",
    items: [
      {
        title: "My Stores",
        subtitle: "Connected online stores",
        href: "/stores",
        icon: Store,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
      {
        title: "My Products",
        subtitle: "All product items",
        href: "/listings",
        icon: Package,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
      {
        title: "Orders",
        subtitle: "Customer purchases",
        href: "/orders",
        icon: ShoppingCart,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
      {
        title: "Stock",
        subtitle: "Warehouse inventory",
        href: "/inventory",
        icon: Boxes,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
    ],
  },
  {
    sectionTitle: "Operations",
    items: [
      {
        title: "Warehouse",
        subtitle: "Pack & ship orders",
        href: "/operations",
        icon: Truck,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
    ],
  },
  {
    sectionTitle: "System",
    items: [
      {
        title: "Update Data",
        subtitle: "Sync with Daraz",
        href: "/sync",
        icon: RefreshCw,
        roles: ["super_admin", "ops_manager"],
      },
      {
        title: "Settings",
        subtitle: "App & team settings",
        href: "/admin",
        icon: Settings,
        roles: ["super_admin"],
      },
    ],
  },
];

export function Sidebar({ userRole = "super_admin", mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <aside className="relative flex h-full w-[272px] flex-col overflow-hidden bg-[#101828] text-slate-100 shadow-[12px_0_40px_rgba(15,23,42,0.08)] select-none shrink-0">
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-orange-500/20 blur-3xl" />
      {/* Brand Header */}
      <div className="relative flex h-[76px] items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-rose-500 font-black text-white text-lg shadow-lg shadow-orange-500/25 border border-white/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-tight text-white leading-none text-sm">Daraz Command</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1">
              Seller operations
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="relative flex-1 space-y-5 px-3 py-5 overflow-y-auto">
        {NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) =>
            userRole === "super_admin" ? true : item.roles.includes(userRole)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              <p className="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">
                {section.sectionTitle}
              </p>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (onCloseMobile) onCloseMobile();
                    }}
                    title={`${item.title} — ${item.subtitle}`}
                    className={`group flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs transition-all duration-200 apple-press ${
                      isActive
                        ? "bg-white text-slate-950 font-bold shadow-lg shadow-black/10"
                        : "text-slate-400 font-medium hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center min-w-0">
                      <Icon className={`mr-2.5 h-4 w-4 flex-shrink-0 ${isActive ? "text-orange-500" : "text-slate-500 group-hover:text-orange-300"}`} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate leading-tight font-bold">{item.title}</span>
                        <span className={`text-[10px] truncate leading-tight mt-0.5 ${isActive ? "text-slate-500" : "text-slate-500"}`}>
                          {item.subtitle}
                        </span>
                      </div>
                    </div>
                    {item.badge && (
                      <span className="ml-1 rounded-full bg-orange-400/20 px-1.5 py-0.5 text-[9px] font-black text-orange-300 border border-orange-400/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Sign Out Footer */}
      <div className="relative border-t border-white/10 p-3">
        <button
          onClick={() => {
            window.location.href = "/api/auth/logout";
          }}
          title="Sign out of your account"
          className="flex w-full items-center rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300 transition-all apple-press border border-transparent hover:border-red-500/20"
        >
          <LogOut className="mr-3 h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar (persistent) */}
      <div className="hidden md:flex h-screen shrink-0">{sidebarContent}</div>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full w-[272px] shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

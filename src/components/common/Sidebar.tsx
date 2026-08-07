"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Lightbulb,
  Users,
  Store,
  Tag,
  Boxes,
  ShoppingCart,
  CheckSquare,
  DollarSign,
  RefreshCw,
  Settings,
  LogOut,
  Sparkles
} from "lucide-react";
import { AppRole } from "@/types/database.types";

interface SidebarProps {
  userRole?: AppRole;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Product Dev (R&D)",
    href: "/product-dev",
    icon: Lightbulb,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Vendors & Suppliers",
    href: "/vendors",
    icon: Users,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Daraz Stores",
    href: "/stores",
    icon: Store,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "AI Listing Studio",
    href: "/studio",
    icon: Sparkles,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Store Listings",
    href: "/listings",
    icon: Tag,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Central Inventory",
    href: "/inventory",
    icon: Boxes,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Operations Center (WMS)",
    href: "/operations",
    icon: CheckSquare,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Orders & Delivery",
    href: "/orders",
    icon: ShoppingCart,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Customer & Returns Center",
    href: "/customers",
    icon: Users,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Team Tasks Board",
    href: "/tasks",
    icon: CheckSquare,
    roles: ["super_admin", "product_manager", "ops_manager"],
  },
  {
    title: "Financial Control",
    href: "/finance",
    icon: DollarSign,
    roles: ["super_admin"],
  },
  {
    title: "Daraz API Sync",
    href: "/sync",
    icon: RefreshCw,
    roles: ["super_admin", "ops_manager"],
  },
  {
    title: "System Admin",
    href: "/admin",
    icon: Settings,
    roles: ["super_admin"],
  },
];

export function Sidebar({ userRole = "super_admin" }: SidebarProps) {
  const pathname = usePathname();

  const filteredNavItems = NAV_ITEMS.filter((item) =>
    userRole === "super_admin" ? true : item.roles.includes(userRole)
  );

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-950/95 text-slate-100 border-r border-slate-800/80 backdrop-blur-2xl select-none z-30">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b border-slate-800/60 px-5">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 font-bold text-white text-lg shadow-lg shadow-orange-500/25 border border-white/20">
            D
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white leading-none text-sm">DARAZ ERP</span>
            <span className="text-[10px] font-bold tracking-widest text-orange-400/90 uppercase mt-0.5">
              Apple Enterprise
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-xl px-3.5 py-2.5 text-xs transition-all duration-200 apple-press ${
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-md shadow-orange-500/25 border border-orange-400/30"
                  : "text-slate-400 font-medium hover:bg-slate-900/80 hover:text-slate-100"
              }`}
            >
              <Icon className={`mr-3 h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span className="truncate">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Team Footer */}
      <div className="border-t border-slate-800/60 p-3">
        <button
          onClick={() => {
            window.location.href = "/login";
          }}
          className="flex w-full items-center rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all apple-press border border-transparent hover:border-red-500/20"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

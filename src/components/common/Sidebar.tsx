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
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-slate-100 border-r border-slate-800">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b border-slate-800 px-6">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500 font-bold text-white text-lg">
            D
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white leading-none">DARAZ</span>
            <span className="text-[10px] font-semibold tracking-wider text-orange-400 uppercase">
              Ops Platform
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-orange-500 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              <Icon className="mr-2.5 h-4 w-4 flex-shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Team Footer */}
      <div className="border-t border-slate-800 p-3">
        <button
          onClick={() => {
            window.location.href = "/login";
          }}
          className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="mr-2.5 h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

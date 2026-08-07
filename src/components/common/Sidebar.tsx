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
  Users,
  UserCheck,
  CheckSquare,
  DollarSign,
  Sparkles,
  Lightbulb,
  Truck,
  RefreshCw,
  Settings,
  LogOut
} from "lucide-react";
import { AppRole } from "@/types/database.types";

interface SidebarProps {
  userRole?: AppRole;
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
        subtitle: "How your business is doing",
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
        title: "My Products",
        subtitle: "All your product items",
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
        subtitle: "Products in warehouse",
        href: "/inventory",
        icon: Boxes,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
      {
        title: "My Stores",
        subtitle: "Connected online stores",
        href: "/stores",
        icon: Store,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
    ],
  },
  {
    sectionTitle: "Create & Build",
    items: [
      {
        title: "Make Product Listing",
        subtitle: "AI page generator",
        href: "/studio",
        icon: Sparkles,
        roles: ["super_admin", "product_manager", "ops_manager"],
        badge: "AI",
      },
      {
        title: "Make New Product",
        subtitle: "Design & test ideas",
        href: "/product-dev",
        icon: Lightbulb,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
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
    sectionTitle: "People & Money",
    items: [
      {
        title: "Suppliers",
        subtitle: "People you buy from",
        href: "/vendors",
        icon: Users,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
      {
        title: "Customers & Returns",
        subtitle: "Buyers & order returns",
        href: "/customers",
        icon: UserCheck,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
      {
        title: "My Tasks",
        subtitle: "Things to do",
        href: "/tasks",
        icon: CheckSquare,
        roles: ["super_admin", "product_manager", "ops_manager"],
      },
      {
        title: "Money",
        subtitle: "Sales, costs & profit",
        href: "/finance",
        icon: DollarSign,
        roles: ["super_admin"],
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
        subtitle: "Team & app setup",
        href: "/admin",
        icon: Settings,
        roles: ["super_admin"],
      },
    ],
  },
];

export function Sidebar({ userRole = "super_admin" }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-950/95 text-slate-100 border-r border-slate-800/80 backdrop-blur-2xl select-none z-30 shrink-0">
      {/* Brand Header */}
      <div className="flex h-16 items-center border-b border-slate-800/60 px-5">
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 font-bold text-white text-lg shadow-lg shadow-orange-500/25 border border-white/20">
            D
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-white leading-none text-sm">DARAZ HUB</span>
            <span className="text-[10px] font-semibold text-orange-400/90 mt-0.5">
              Simple Operations
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
        {NAV_SECTIONS.map((section, sIdx) => {
          const visibleItems = section.items.filter((item) =>
            userRole === "super_admin" ? true : item.roles.includes(userRole)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              <p className="px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {section.sectionTitle}
              </p>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={`${item.title} — ${item.subtitle}`}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all duration-200 apple-press ${
                      isActive
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold shadow-md shadow-orange-500/25 border border-orange-400/30"
                        : "text-slate-400 font-medium hover:bg-slate-900/80 hover:text-slate-100"
                    }`}
                  >
                    <div className="flex items-center min-w-0">
                      <Icon className={`mr-2.5 h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate leading-tight font-bold">{item.title}</span>
                        <span className={`text-[10px] truncate leading-tight mt-0.5 ${isActive ? "text-orange-100" : "text-slate-500"}`}>
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
      <div className="border-t border-slate-800/60 p-3">
        <button
          onClick={() => {
            window.location.href = "/api/auth/logout";
          }}
          title="Sign out of your account"
          className="flex w-full items-center rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all apple-press border border-transparent hover:border-red-500/20"
        >
          <LogOut className="mr-3 h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

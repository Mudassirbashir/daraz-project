import React from "react";
import { AppRole } from "@/types/database.types";

interface RoleBadgeProps {
  role: AppRole;
  userName?: string;
}

const ROLE_STYLES: Record<AppRole, { defaultName: string; label: string; className: string }> = {
  super_admin: {
    defaultName: "Mubashir",
    label: "Super Admin",
    className: "bg-purple-50/90 text-purple-800 border-purple-200/80 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20",
  },
  product_manager: {
    defaultName: "Mudassir",
    label: "Product Manager",
    className: "bg-blue-50/90 text-blue-800 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  },
  ops_manager: {
    defaultName: "Zainab",
    label: "Ops Manager",
    className: "bg-emerald-50/90 text-emerald-800 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  },
  admin: {
    defaultName: "Admin",
    label: "Admin",
    className: "bg-indigo-50/90 text-indigo-800 border-indigo-200/80 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
  },
  warehouse_operator: {
    defaultName: "Warehouse Operator",
    label: "Warehouse Operator",
    className: "bg-amber-50/90 text-amber-800 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  },
  viewer: {
    defaultName: "Viewer",
    label: "Viewer",
    className: "bg-slate-50/90 text-slate-800 border-slate-200/80 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
  },
};

export function RoleBadge({ role, userName }: RoleBadgeProps) {
  const style = ROLE_STYLES[role] || {
    defaultName: userName || "Team Member",
    label: role,
    className: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200",
  };

  const displayName = userName || style.defaultName;

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold border backdrop-blur-md shadow-2xs select-none ${style.className}`}
    >
      <span className="font-bold text-slate-900 dark:text-white">{displayName}</span>
      <span className="text-[10px] font-semibold opacity-70">({style.label})</span>
    </span>
  );
}

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
    className: "bg-purple-100 text-purple-800 border-purple-300",
  },
  product_manager: {
    defaultName: "Mudassir",
    label: "Product Manager",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  ops_manager: {
    defaultName: "Zainab",
    label: "Ops Manager",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
};

export function RoleBadge({ role, userName }: RoleBadgeProps) {
  const style = ROLE_STYLES[role] || {
    defaultName: userName || "Team Member",
    label: role,
    className: "bg-gray-100 text-gray-800 border-gray-300",
  };

  const displayName = userName || style.defaultName;

  return (
    <span
      className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.className}`}
    >
      <span className="font-bold">{displayName}</span>
      <span className="text-[10px] opacity-75">({style.label})</span>
    </span>
  );
}

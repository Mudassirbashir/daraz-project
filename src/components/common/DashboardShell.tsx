"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/common/Sidebar";
import { Header } from "@/components/common/Header";
import { StoreOption } from "@/components/common/StoreSwitcher";
import { AppRole } from "@/types/database.types";

interface DashboardShellProps {
  userRole: AppRole;
  userName: string;
  stores: StoreOption[];
  region: string;
  children: React.ReactNode;
}

export function DashboardShell({
  userRole,
  userName,
  stores,
  region,
  children,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar
        userRole={userRole}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          userRole={userRole}
          userName={userName}
          stores={stores}
          region={region}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

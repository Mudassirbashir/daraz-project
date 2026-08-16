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
    <div className="app-shell flex h-[100dvh] overflow-hidden bg-[#f6f7fb] text-slate-950 dark:bg-slate-950">
      <Sidebar
        userRole={userRole}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          userRole={userRole}
          userName={userName}
          stores={stores}
          region={region}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />
        <main className="app-main flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

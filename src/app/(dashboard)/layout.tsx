import React from "react";
import { Sidebar } from "@/components/common/Sidebar";
import { Header } from "@/components/common/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In production, user roles and profile will be fetched via Server Supabase client
  const demoRole = "super_admin";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar userRole={demoRole} />

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userRole={demoRole} userName="Daraz Operations Lead" />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import React, { Suspense } from "react";
import { RoleSelectionGate } from "@/components/common/RoleSelectionGate";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-white text-sm">Loading Daraz Operations Gate...</div>}>
      <RoleSelectionGate />
    </Suspense>
  );
}

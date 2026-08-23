"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight, Store, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("mubashir@darazops.internal");
  const [password, setPassword] = useState("DarazOps2026!");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("oauth_error") || null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(
    searchParams.get("oauth_success") ? "Daraz OAuth authorization completed successfully!" : null
  );

  const performLogin = async (targetEmail: string, targetPass: string) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Call server authentication API endpoint
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Invalid login credentials. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Sync browser client Supabase authentication state if available
      try {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: targetPass,
        });
      } catch (_) {}

      setSuccessMessage("Login successful! Redirecting to hub...");
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Login Exception:", err.message);
      setErrorMessage(err.message || "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const handleQuickRoleSelect = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("DarazOps2026!");
    performLogin(roleEmail, "DarazOps2026!");
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 font-black text-white text-3xl shadow-lg shadow-orange-500/30">
          D
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Welcome to Daraz Operations
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Sign in to manage your stores, products, and orders.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center space-x-2 p-3.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center space-x-2 p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mubashir@darazops.internal"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all active:scale-[0.99]"
        >
          <Lock className="mr-2 h-4 w-4" />
          <span>{loading ? "Signing In..." : "Sign In"}</span>
        </button>
      </form>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-400 font-medium">Quick Access Profiles</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          onClick={() => handleQuickRoleSelect("mubashir@darazops.internal")}
          className="p-2.5 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/50 transition-all text-xs active:scale-95"
        >
          <span className="block font-bold text-slate-800">Mubashir</span>
          <span className="text-[10px] text-slate-500">Super Admin</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickRoleSelect("mudassir@darazops.internal")}
          className="p-2.5 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/50 transition-all text-xs active:scale-95"
        >
          <span className="block font-bold text-slate-800">Mudassir</span>
          <span className="text-[10px] text-slate-500">Product Manager</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickRoleSelect("zainab@darazops.internal")}
          className="p-2.5 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/50 transition-all text-xs active:scale-95"
        >
          <span className="block font-bold text-slate-800">Zainab</span>
          <span className="text-[10px] text-slate-500">Ops Manager</span>
        </button>
      </div>

      <div className="pt-2 border-t border-slate-100 text-center">
        <a
          href="/api/auth/daraz/login"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-orange-600 hover:text-orange-700"
        >
          <Store className="h-3.5 w-3.5" />
          <span>Connect Daraz Seller OAuth Account</span>
          <ArrowRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="text-white text-sm">Loading Daraz Operations Portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

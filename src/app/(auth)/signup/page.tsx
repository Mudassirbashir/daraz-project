"use client";

import React, { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ArrowRight, Store, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ops_manager");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password || !fullName) {
      setErrorMessage("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      // 1. Call server signup endpoint
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Sync browser client Supabase authentication state if available
      try {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      } catch (_) {}

      setSuccessMessage("Account created successfully! Redirecting to dashboard...");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (err: any) {
      console.error("Signup Exception:", err.message);
      setErrorMessage(err.message || "Failed to sign up. Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 font-black text-white text-3xl shadow-lg shadow-orange-500/30">
          D
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Create Operations Account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Register to get access to Daraz store management portal.
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

      <form onSubmit={handleSignupSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Full Name
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Ali Khan"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
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
            placeholder="Minimum 6 characters"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Access Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all bg-white"
          >
            <option value="super_admin">Super Admin</option>
            <option value="product_manager">Product Manager</option>
            <option value="ops_manager">Operations Manager</option>
            <option value="warehouse_operator">Warehouse Operator</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all active:scale-[0.99]"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          <span>{loading ? "Creating Account..." : "Sign Up"}</span>
        </button>
      </form>

      <div className="pt-4 border-t border-slate-100 text-center space-y-2">
        <p className="text-xs text-slate-500">
          Already have an account?{" "}
          <a
            href="/login"
            className="font-bold text-orange-600 hover:text-orange-700 hover:underline"
          >
            Sign In here
          </a>
        </p>

        <div className="pt-2">
          <a
            href="/api/auth/daraz/login"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-orange-600 transition-colors"
          >
            <Store className="h-3.5 w-3.5" />
            <span>Connect Daraz Seller OAuth Account</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard since signup feature is removed
    // The dashboard will show role selection when no authenticated user is present
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="text-white text-sm">Loading Registration Portal...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}

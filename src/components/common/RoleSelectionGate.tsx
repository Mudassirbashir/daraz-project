"use client";

import React, { useState } from "react";
import { ShieldCheck, Cpu, UserCheck, ArrowRight, Sparkles } from "lucide-react";

export function RoleSelectionGate() {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectRole = (email: string) => {
    setSelectedEmail(email);
    setPassword("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: selectedEmail, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = "/dashboard";
      } else {
        throw new Error(data.message || "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 select-none">
      <div className="w-full max-w-lg space-y-6 rounded-3xl bg-slate-900/90 border border-slate-800 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 font-black text-white text-3xl shadow-lg shadow-orange-500/20">
            D
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Welcome to Daraz Operations Portal
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Select your role and enter your password to access the portal.
          </p>
        </div>

        {selectedEmail ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-1">
                Password
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-white placeholder-slate-400 transition-all"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-orange-600 hover:bg-orange-700 transition-all text-white font-medium active:scale-[0.99] shadow-md"
            >
              <span>Continue to Dashboard</span>
              <ArrowRight className="h-5 w-5 shrink-0 ml-2" />
            </button>
            {error && (
              <p className="text-xs text-red-400 text-center mt-2">
                {error}
              </p>
            )}
          </form>
        ) : (
          <div className="space-y-3.5 pt-4">
            {/* Option 1: Admin */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSelectRole("mubashir@darazops.internal")}
              className="w-full group flex items-center justify-between p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-orange-500/80 hover:bg-orange-500/10 transition-all text-left active:scale-[0.99] shadow-md"
            >
              <div className="flex items-center space-x-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-all">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">You Are Admin</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300">
                      Super Admin
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Full system control, store setup, financial records & user administration
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>

            {/* Option 2: Operation */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSelectRole("zainab@darazops.internal")}
              className="w-full group flex items-center justify-between p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-blue-500/80 hover:bg-blue-500/10 transition-all text-left active:scale-[0.99] shadow-md"
            >
              <div className="flex items-center space-x-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">You Are Operation</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300">
                      Ops Manager
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order processing, barcode scanning, packing labels & inventory ledger
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>

            {/* Option 3: Direct Account Access */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSelectRole("mudassir@darazops.internal")}
              className="w-full group flex items-center justify-between p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/80 hover:bg-emerald-500/10 transition-all text-left active:scale-[0.99] shadow-md"
            >
              <div className="flex items-center space-x-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">Direct Account Access</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                      Product Manager
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter application directly without password or login credentials
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>
          </div>
        )}

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-center space-x-1.5">
          <Sparkles className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
          <span>Secure Role-Based Access • Daraz Store Operations</span>
        </div>
      </div>
    </div>
  );
}
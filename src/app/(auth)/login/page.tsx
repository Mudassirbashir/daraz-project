import React from "react";
import { Lock } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 font-bold text-white text-2xl">
            D
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Daraz Operations Portal
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Sign in with your employee credentials to access hub management.
          </p>
        </div>

        <form className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Employee Email
              </label>
              <input
                type="email"
                required
                placeholder="employee@daraz.com"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex w-full justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
          >
            <Lock className="mr-2 h-4 w-4" />
            Sign In to Hub
          </button>
        </form>
      </div>
    </div>
  );
}

import React from "react";
import { StoreOnboardingClient } from "@/components/stores/StoreOnboardingClient";
import { getStoreDisplayName, getStoreInitials } from "@/lib/daraz/store-utils";
import { ShieldCheck, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AsaanRetailDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Asaan Retail-Style Daraz Integration
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Experience simplified Daraz store connection inspired by Asaan Retail's approach
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Standard OAuth Card */}
          <section className="rounded-2xl border p-8 bg-white dark:bg-slate-900/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Standard OAuth Connection
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                  Full-featured authentication with token refresh, granular permissions, and advanced sync controls
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Features
              </h3>
              <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
                <li>OAuth 2.0 with secure token storage</li>
                <li>Automatic token refresh</li>
                <li>Granular permission controls</li>
                <li>Advanced sync scheduling</li>
                <li>Webhook support for real-time updates</li>
                <li>Detailed audit logging</li>
              </ul>
            </div>

            <StoreOnboardingClient
              isMaxStoresReached={false}
              storeId=""
              storeName=""
              isConnected={false}
              mode="button"
            />
          </section>

          {/* Asaan Retail Style Card */}
          <section className="rounded-2xl border p-8 bg-white dark:bg-slate-900/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-300 border-l-4 border-orange-500">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Asaan Retail-Style Connection
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                  Simplified 30-second connection requiring active Daraz Seller Portal session
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Features
              </h3>
              <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
                <li>Quick 30-second setup</li>
                <li>No complex OAuth flows</li>
                <li>Active session validation for security</li>
                <li>Ideal for quick store connections</li>
                <li>Mirrors Asaan Retail's approach</li>
                <li>Development-friendly validation</li>
              </ul>
            </div>

            <StoreOnboardingClient
              isMaxStoresReached={false}
              storeId=""
              storeName=""
              isConnected={false}
              mode="button"
            />
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            How It Works
          </h2>

          <ol className="space-y-4 text-slate-600 dark:text-slate-400">
            <li className="flex items-start space-x-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-medium text-xs mt-0.5">
                1
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white">Enter Credentials</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Provide your Daraz App Key and App Secret from <a href="https://open.daraz.com" className="text-orange-600 hover:underline dark:text-orange-400">open.daraz.com</a>
                </p>
              </div>
            </li>

            <li className="flex items-start space-x-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-medium text-xs mt-0.5">
                2
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white">Choose Method</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Select either Standard OAuth (full features) or Asaan Retail-style (quick connect)
                </p>
              </div>
            </li>

            <li className="flex items-start space-x-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-medium text-xs mt-0.5">
                3
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white">Validate Session</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  For Asaan Retail-style: Ensure you're logged into Daraz Seller Portal in your browser
                </p>
              </div>
            </li>

            <li className="flex items-start space-x-4">
              <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-medium text-xs mt-0.5">
                4
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-slate-900 dark:text-white">Start Syncing</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Your Daraz store is now connected and ready for product, order, and inventory synchronization
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
"use client";

import React, { useState, useEffect } from "react";
import { Store, ShieldCheck, Loader2, Copy, Check, X, KeyRound, HelpCircle, Eye, EyeOff, Zap, MousePointer } from "lucide-react";

interface StoreOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconnectStoreId?: string | null;
  reconnectStoreName?: string | null;
}

export function StoreOnboardingModal({
  isOpen,
  onClose,
  reconnectStoreId,
  reconnectStoreName,
}: StoreOnboardingModalProps) {
  const [storeUsername, setStoreUsername] = useState("");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<"oauth" | "asaan">("oauth"); // oauth or asaan retail style
  const [validationStep, setValidationStep] = useState<"credentials" | "validation" | "completed">("credentials");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setRedirectUrl(`${origin}/api/daraz/oauth/callback`);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setIsAuthorizing(false);
      setValidationStep("credentials");
      // Reset to OAuth by default when opening modal
      setAuthMethod("oauth");
    }
  }, [isOpen]);

  const handleCopyRedirectUrl = () => {
    if (!redirectUrl) return;
    navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAuthorize = async () => {
    if (!appKey.trim()) {
      setErrorMessage("App Key is required to connect your Daraz store.");
      return;
    }
    if (!appSecret.trim()) {
      setErrorMessage("App Secret is required to connect your Daraz store.");
      return;
    }

    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      if (authMethod === "oauth") {
        // Standard OAuth flow
        const res = await fetch("/api/daraz/oauth/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_key: appKey.trim(),
            app_secret: appSecret.trim(),
            store_username: storeUsername.trim(),
            reconnect_store_id: reconnectStoreId || null,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success || !data.authUrl) {
          throw new Error(data.error || "Failed to initiate Daraz Seller Center authorization.");
        }

        window.location.href = data.authUrl;
      } else {
        // Asaan Retail-style flow
        const res = await fetch(`/api/daraz/asaan-retail?app_key=${encodeURIComponent(appKey.trim())}&app_secret=${encodeURIComponent(appSecret.trim())}&store_username=${encodeURIComponent(storeUsername.trim())}&store_id=${reconnectStoreId || ""}`, {
          method: "GET",
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to initiate Asaan Retail-style authentication.");
        }

        // Redirect to validation page
        window.location.href = data.authUrl || `${window.location.origin}/daraz/asaan-retail/validate?state=${data.state}`;
      }
    } catch (err: any) {
      setIsAuthorizing(false);
      setErrorMessage(err.message || "Failed to initiate Daraz authorization.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 pr-8">
          <div className="h-12 w-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20 shrink-0">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {reconnectStoreId ? `Reconnect Store: ${reconnectStoreName || "Daraz Store"}` : "Connect Daraz Store"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daraz Open Platform Application Credentials & Seller Authorization
            </p>
          </div>
        </div>

        {/* Auth Method Selector */}
        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2 text-xs">
            <MousePointer className="h-4 w-4 text-orange-500" />
            <span>Choose Authentication Method</span>
          </h3>

          <div className="flex items-center space-x-4 pt-2">
            <label className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                value="oauth"
                checked={authMethod === "oauth"}
                onChange={(e) => setAuthMethod(e.target.value as "oauth")}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm">Standard OAuth</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                value="asaan"
                checked={authMethod === "asaan"}
                onChange={(e) => setAuthMethod(e.target.value as "asaan")}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm">Asaan Retail Style</span>
            </label>
          </div>

          {authMethod === "asaan" && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500">
              <div className="flex items-center space-x-2 text-xs">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Simplified authentication requiring active Daraz Seller Portal session</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                This method mirrors Asaan Retail's approach: enter your API credentials and ensure you're logged into Daraz Seller Portal in your browser.
              </p>
            </div>
          )}
        </div>

        {/* Form Body - Changes based on auth method and validation step */}
        {validationStep === "credentials" && (
          <>
            {/* Step 1: Daraz Open Platform App Credentials */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2 text-xs">
                <KeyRound className="h-4 w-4 text-orange-500" />
                <span>Step 1: Daraz Open Platform Credentials</span>
              </h3>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  App Key
                </label>
                <input
                  type="text"
                  placeholder="Enter App Key from open.daraz.com"
                  value={appKey}
                  onChange={(e) => setAppKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block flex items-center justify-between">
                  <span>App Secret</span>
                  <span className="text-[10px] font-normal text-slate-400">Encrypted server-side at rest</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showSecret ? "text" : "password"}
                    placeholder="Enter App Secret from open.daraz.com"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Store Username / Label */}
            <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
                Step 2: Store Username / Store Label
              </h3>
              <input
                type="text"
                placeholder="e.g. ISD Traders"
                value={storeUsername}
                onChange={(e) => setStoreUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-[10px] text-slate-400 font-medium pt-0.5">
                This is a user-friendly label. Official store name and Seller ID will be retrieved automatically from Daraz upon authorization.
              </p>
            </div>

            {errorMessage && (
              <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-200 dark:border-red-500/20">
                {errorMessage}
              </p>
            )}

            {/* Step 3: Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isAuthorizing}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAuthorize}
                disabled={isAuthorizing}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all inline-flex items-center space-x-2 apple-press disabled:opacity-50"
              >
                {isAuthorizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting to Daraz...</span>
                  </>
                ) : (
                  <>
                    {authMethod === "oauth" ? <ShieldCheck className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    <span>Authorize Daraz Store</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {validationStep === "validation" && authMethod === "asaan" && (
          <>
            <div className="text-center py-8">
              <MousePointer className="h-8 w-8 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Please Log Into Daraz Seller Portal
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                To complete the Asaan Retail-style authentication, please ensure you are logged into your Daraz Seller Portal in your browser.
              </p>
              <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center space-x-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">1. Open Daraz Seller Portal</span>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20">
                  <MousePointer className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">2. Log into your seller account</span>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20">
                  <Check className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">3. Return here to validate</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setValidationStep("completed")}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all"
              >
                I'm Logged In - Validate Session
              </button>
            </div>
          </>
        )}

        {validationStep === "completed" && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 text-orange-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Validating your Daraz Seller Portal session...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}